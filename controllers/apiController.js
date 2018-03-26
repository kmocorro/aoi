let Promise = require('bluebird');
let bodyParser = require('body-parser');
let moment = require('moment');
let fs = require('fs');
let Tail = require('tail').Tail;
let TSV = require('tsv');
let mysqlLocal = require('../dbConfig/dbLocal');
let mysqlCloud = require('../dbConfig/dbCloud');
let mysqlMES = require('../dbConfig/dbMES');

module.exports = function(app) {

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    app.get('/', function(req, res){
        res.redirect('/ntm');
    });

    app.get('/:process', function(req, res){
        let process = req.params.process
        let processToUpper = process.toUpperCase();
        let ipUser = req.ip;

        if(process == 'ntm' || process == 'ptm' || process == 'plm'){
            res.render('realtime', {process_name: processToUpper});
            console.log(ipUser + ' @ ' + moment(Date.now()).format('llll') + ' - ' + process);
        } else {
            res.send('404');
        }
    });

    app.get('/backtrack/:process', function(req, res){

        

    });
}