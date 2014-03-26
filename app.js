var FS = require('fs');
var fetch = require('./fetch');


var bookUrl = 'http://h5.qidian.com/bookinfo.html?bookid=3092598';
var bookBasePath;
var bookName;

function appendNextChapter(lines, i) {
    var chapter = lines[i].trim();
    if (chapter) {
        FS.readFile(bookBasePath + chapter + '.txt', function(err, data) {
            if (err) {throw err;}
            var dataWrapper = chapter +'\n' + data.toString() + '\n\n';
            FS.appendFile('./output/' + bookName, dataWrapper, {encoding: 'utf8', flag: 'a'}, function(err) {
                if (err) {throw err;}
                appendNextChapter(lines, ++i);
            });                
        });            
    }
}

fetch.book(bookUrl, function(book) {
    bookBasePath = './output/' + book.bookName + '-' + book.authorName + '/';
    bookName = book.bookName + '-' + book.authorName + '.txt';
    FS.readFile(bookBasePath + 'chapters.txt', function(err, data) {
        if (err) {throw err;}
        var lines = data.toString().split('\n');
        appendNextChapter(lines, 0);
    });
});

