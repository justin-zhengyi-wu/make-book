/*jslint node: true, stupid: true */
var Request = require('request');
var FS = require('fs');
var URL = require('url');
var QueryString = require('querystring');
var Events = require('events');


exports.book = function(bookUrl, callback) {
    var eventEmitter = new Events.EventEmitter();
    var bookName, bookId, authorName, baseUrl, bookInfoUrl, bookChaptersUrl, chapterUrl, outputFolder = './output/';

    function extractBookId(url) {
        var urlObj = URL.parse(url);
        var queryStrinObj = QueryString.parse(urlObj.query);
        return queryStrinObj.bookid;
    }
    function extractBaseUrl(url) {
        var urlObj = URL.parse(url);
        return urlObj.protocol + '//' + urlObj.hostname + (urlObj.port || '') + '/';
    }
    function writeFileCallbackHandler(err) {
        if (err) {throw err;}    
    }
    function sendNextRequestThenWriteFile(bookFolder, chaptersUrlArray, index) {
        if (index < chaptersUrlArray.length) {
            var opt = {
                url: chaptersUrlArray[index].url,
                json: true
            };
            Request(opt, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var content = body.ReturnObject[0].Content;
                    // Replace the paragraph elements with new lines.
                    content = content.replace(/<p>/g,'\n');
                    // Remove the link tags.
                    content = content.replace(/<a(?:.|\n)*\/a>/gm, '');
                    FS.writeFile(bookFolder + chaptersUrlArray[index].name + '.txt', content, writeFileCallbackHandler);
                }
                sendNextRequestThenWriteFile(bookFolder, chaptersUrlArray, ++index);            
            }); 
        } else {
            eventEmitter.emit('bookDataFetched');
        }
    }


    bookId = extractBookId(bookUrl);
    baseUrl = extractBaseUrl(bookUrl);
    bookInfoUrl = baseUrl + 'Book/BookInfo.ashx?ajaxMethod=getbookinfo&bookid=' + bookId;
    bookChaptersUrl = baseUrl + 'Book/BookInfo.ashx?ajaxMethod=getallvolumechapter&isreadvip=0&bookid=' + bookId;
    chapterUrl = baseUrl + 'Book/BookReader.ashx?ajaxMethod=getchapterinfonew&bookId=' + bookId +'&chapterId=';

    Request({url: bookInfoUrl, json: true}, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            if (!body.IsSuccess) {
                throw new Error(body.ReturnString);
            }
            var data = body.ReturnObject[0].ReturnObject;
            bookName = data.BookName;
            authorName = data.AuthorName;

            Request({url: bookChaptersUrl, json: true}, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    if (!body.IsSuccess) {
                        throw new Error(body.ReturnString);
                    }

                    if (!FS.existsSync(outputFolder)) {
                        FS.mkdirSync(outputFolder);
                    }

                    var chapters = body.ReturnObject[1];
                    var bookFolder = outputFolder + bookName + '-' + authorName + '/';
                    if (!FS.existsSync(bookFolder)) {
                        FS.mkdirSync(bookFolder);
                    }

                    var chaptersData = '';
                    var chapterName = '';
                    var chapterId;
                    var chaptersUrlArray = [];
                    var i = 0;
                    var len = chapters.length;
                    while (i < len) {
                        chapterName = chapters[i].ChapterName;
                        chapterId = chapters[i].ChapterId;
                        chaptersUrlArray.push({url: chapterUrl + chapterId, name: chapterName});
                        chaptersData += chapterName + '\n';
                        i++;
                    }

                    FS.writeFile(bookFolder + 'chapters.txt', chaptersData, writeFileCallbackHandler);
                    
                    sendNextRequestThenWriteFile(bookFolder, chaptersUrlArray, 0);
                } else {
                    throw new Error(error);
                }
            });

        } else {
            throw new Error(error);
        }
    });

    eventEmitter.on('bookDataFetched', function() {
        if (callback) {
            var book = {
                bookName: bookName,
                authorName: authorName
            }
            callback(book);
        }    
    });
};


