/*jslint node: true, stupid: true */
var Request = require('request');
var FS = require('fs');
var URL = require('url');
var QueryString = require('querystring');
var Events = require('events');


exports.book = function(bookUrl, callback) {
    var eventEmitter = new Events.EventEmitter();
    var bookName, bookId, authorName, baseUrl, bookInfoUrl, bookChaptersUrl, chapterUrl, outputFolder = './output/', downloadedChaptersNum = 0, chaptersNum = 0;

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
        if (downloadedChaptersNum++ === chaptersNum) {
            eventEmitter.emit('bookDataFetched');
        }
    }
    function fetchChapterThenWrite(bookFolder, chapter) {
        var chapterName = chapter.name;
        Request({url: chapter.url, json: true}, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var content = body.ReturnObject[0].Content;
                // Replace the paragraph elements with new lines.
                content = content.replace(/<p>/g,'\n');
                // Remove the link tags.
                content = content.replace(/<a(?:.|\n)*\/a>/gm, '');
                console.log("Start to download chapter " + chapterName + " ...");
                FS.writeFile(bookFolder + chapterName + '.txt', content, writeFileCallbackHandler);
            }
        });         
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
                    chaptersNum = chapters.length;
                    var bookFolder = outputFolder + bookName + '-' + authorName + '/';
                    if (!FS.existsSync(bookFolder)) {
                        FS.mkdirSync(bookFolder);
                    }

                    var chaptersData = '';
                    var chapterName = '';
                    var chapterId;
                    var i = 0;
                    var len = chapters.length;
                    while (i < len) {
                        chapterName = chapters[i].ChapterName;
                        chaptersData += chapterName + '\n';

                        chapterId = chapters[i].ChapterId;
                        fetchChapterThenWrite(bookFolder, {url: chapterUrl + chapterId, name: chapterName});

                        i++;
                    }

                    FS.writeFile(bookFolder + 'chapters.txt', chaptersData, writeFileCallbackHandler);
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
            };
            callback(book);
        }    
    });
};


