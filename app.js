var request = require('request');
var fs = require('fs');
var URL = require('url');
var QueryString = require('querystring');

var bookInfoUrl = 'http://h5.qidian.com/Book/BookInfo.ashx?bookid=3092598&ajaxMethod=getbookinfo';
var outputFolder = './output/';
var bookId = extractBookId(bookInfoUrl);
var baseUrl = extractUrlBase(bookInfoUrl);
var bookChaptersUrl = baseUrl + 'Book/BookInfo.ashx?bookid=' + bookId + '&ajaxMethod=getallvolumechapter&isreadvip=0';
var chapterUrl = baseUrl + 'Book/BookReader.ashx?ajaxMethod=getchapterinfonew&bookId=' + bookId +'&chapterId=';


function extractBookId(url) {
    var urlObj = URL.parse(url);
    var queryStrinObj = QueryString.parse(urlObj.query);
    return queryStrinObj.bookid;
}

function extractUrlBase(url) {
    var urlObj = URL.parse(url);
    var baseUrl = urlObj.protocol + '//' + urlObj.hostname + (urlObj.port || '') + '/';
    return baseUrl;
}

request({url: bookInfoUrl, json: true}, function(error, response, body) {
    if (!error && response.statusCode == 200) {
        if (!body.IsSuccess) {
            throw new Error(body.ReturnString);
        }
        var data = body.ReturnObject[0].ReturnObject;
        var bookName = data.BookName;
        var authorName = data.AuthorName;

        request({url: bookChaptersUrl, json: true}, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                if (!body.IsSuccess) {
                    throw new Error(body.ReturnString);
                }

                if (!fs.existsSync(outputFolder)) {
                    fs.mkdirSync(outputFolder);
                }

                var chapters = body.ReturnObject[1];
                var bookFolder = outputFolder + bookName + '-' + authorName + '/';
                if (!fs.existsSync(bookFolder)) {
                    fs.mkdirSync(bookFolder);
                }
                var chaptersData = '';
                var chaptersUrlArray = [];
                for (var i = 0, l = chapters.length; i < l; i++) {
                    var chapterName = chapters[i].ChapterName;
                    var chapterId = chapters[i].ChapterId;
                    var chapterFolder = bookFolder + chapterName + '/';
                    chaptersUrlArray.push({url: chapterUrl + chapterId, name: chapterName});
                    chaptersData += chapterName + '\n';
                }

                function sendNextRequest(index) {
                    if (index < chaptersUrlArray.length) {
                        var opt = {
                            url: chaptersUrlArray[index].url,
                            json: true
                        };

                        request(opt, function(error, response, body) {
                            if (!error && response.statusCode == 200) {
                                var content = body.ReturnObject[0].Content;
                                content = content.replace(/<p>/g,'\n');
                                content = content.replace(/<(.)+>(?:.|\n)*<\/\1>/gm, '');
                                fs.writeFile(bookFolder + chaptersUrlArray[index].name + '.txt', content, function(err) {
                                    if (err) throw err;
                                });
                            }
                            sendNextRequest(++index);
                        }); 
                    }
                }
                sendNextRequest(0);
                
                for (var j = 0, l = chaptersUrlArray.length; j < l; j++) {
                    request({url: chaptersUrlArray[j], json: true}, function(error, response, body) {
                        if (!error && response.statusCode == 200) {
                            var content = body.ReturnObject.Content;
                            fs.writeFile(bookFolder + chapterName + '.txt', content, function(err) {
                                if (err) throw err;
                            });
                        }
                    });
                }

                fs.writeFile(bookFolder + 'chapters.txt', chaptersData, function(err) {
                    if (err) {
                        throw err;
                    }
                });

                
            } else {
                throw new Error(error);
            }
        });

    } else {
        throw new Error(error);
    }
});




