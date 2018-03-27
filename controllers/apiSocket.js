let Promise = require('bluebird');
let bodyParser = require('body-parser');
let mysqlLocal = require('../dbConfig/dbLocal');
let mysqlCloud = require('../dbConfig/dbCloud');
let mysqlMES = require('../dbConfig/dbMES');
let socketConfig = require('../socketConfig/config');
let moment = require('moment');
let Tail = require('tail').Tail;
let TSV = require('tsv');
let fs = require('fs');

module.exports = function(io){
    let ntm_FileFolder = socketConfig.path_config.ntm;
    let ptm_FileFolder = socketConfig.path_config.ptm;
    let plm_FileFolder = socketConfig.path_config.plm;

    let logFile_obj = socketConfig.tools;
    
    for(let j=0; j<logFile_obj.ntm.tool_name.length; j++){ // NTM tools
        let pathToFolder = ntm_FileFolder + logFile_obj.ntm.tool_name[j];
        let pathToLog = pathToFolder + '\\' + moment(Date.now()).format('YYMMDD') + '_CMYK_PPDataLog.txt';

        fs.stat(pathToLog, function(err, stat){ // check if file exists
            if(err == null){ 
                tail = new Tail(pathToLog);

                tail.on('line', function(data){
                    let data_arr = [];
        
                    function cleaner(){
                        return new Promise(function(resolve, reject){
                
                           //** start CLEANING log changes 
                           let line = data.split('\r\n'); // remove \t
                           line.map(function(item){
                               let tabs = item.split('\t');
                               
                               let tab_Nest = tabs[3].split('\r\n'); // remove ;
                               tab_Nest.map(function(item){
                                   let nest = item.split(';');
                                   //console.log(nest);
                   
                                   let nest_num = nest[0].split('\r\n'); // remove : @ nest
                                   let pressure_num = nest[1].split('\r\n');  // remove : @ pressure
                                   nest_num.map(function(item){
                                       let nest_val = item.split(':');
                                   ////console.log(nest_val[1]);
                                       
                                       pressure_num.map(function(item){
                                           let pressure_val = item.split(':');
                                           //console.log(pressure_val[1]);
                                           let datetime = moment(new Date(tabs[0] + ' ' + tabs[1])).format();
                                           
                                           data_arr.push(datetime, logFile_obj.ntm.tool_name[j], tabs[2], nest_val[1].replace(/ /g, ''), pressure_val[1].replace(/ /g, ''), 'NTM');
                   
                                           resolve(data_arr);
                                       //console.log(data_arr);
                                           //** end of CLEANING log changes
                                       });
                                   });
                               });
                           });
                
                        });
                    }

                    cleaner().then(function(data_arr){
                           
                        io.volatile.emit(logFile_obj.ntm.tool_name[j] + '_client', data_arr);
                        
                        mysqlCloud.poolCloud.getConnection(function(err, connection){

                            function toCloudDB(){
                                return new Promise(function(resolve, reject){

                                    connection.query({
                                        sql: 'INSERT INTO tbl_patterning_cmyk_logs SET date_time =?, tool_name =?, log_type=?, nest=?, pressure=?, process=?',
                                        values: [data_arr[0], data_arr[1], data_arr[2], data_arr[3], data_arr[4], data_arr[5]]
                                    },  function(err, results, fields){
                                        resolve('inserted');
                                    });

                                });

                            }

                            function querySTDev(){
                                return new Promise(function(resolve, reject){
                                    let dateToday = moment(new Date()).format('YYYY-MM-DD');
                                    
                                    connection.query({
                                        sql: 'SELECT STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE process = "NTM" AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59")',
                                        values: [dateToday, dateToday]
                                    }, function(err, results, fields){

                                        if(results){
                                            if(typeof results[0] != 'undefined' && results[0] != null && results.length > 0){
                                                let stdev = (results[0].STD_pressure).toFixed(4);
                                                resolve(stdev);
                                            } else {
                                                reject('error in querySTDEV NTM');
                                            }
                                        }
                                        
                                    });

                                });
                            }

                            function queryEachSTDev(){
                                return new Promise(function(resolve, reject){
                                    let dateToday = moment(new Date()).format('YYYY-MM-DD');

                                    connection.query({
                                        sql: 'SELECT STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE tool_name=? AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59")',
                                        values: [data_arr[1], dateToday, dateToday]
                                    }, function(err, results, fields){

                                        if(results){
                                            if(typeof results[0] != 'undefined' && results[0] != null && results.length > 0){
                                                let stdev_per_tool = (results[0].STD_pressure).toFixed(4);
                                                resolve(stdev_per_tool);
                                            } else {
                                                reject('error in queryEachSTDev NTM');
                                            }
                                        }
                                        
                                    });
                                    
                                });
                            }

                            function queryEachNestToNestSTDev(){ // nest to nest
                                return new Promise(function(resolve, reject){
                                    let dateToday = moment(new Date()).format('YYYY-MM-DD');
                                    
                                    connection.query({
                                        sql: 'SELECT tool_name, nest, STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE tool_name=? AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59") GROUP BY nest',
                                        values: [data_arr[1], dateToday, dateToday]
                                    },  function(err, results, fields){
                                            if(results){
                                                if(typeof results[0] != 'undefined' && results[0] != null && results.length >0){
                                                    
                                                    let stdev_per_tool_per_nest = [];

                                                    for(let i = 0; i <results.length; i++){

                                                        stdev_per_tool_per_nest.push({
                                                            tool_name: results[i].tool_name,
                                                            nest: results[i].nest,
                                                            stdev: results[i].STD_pressure
                                                        });
                                                        
                                                        if(i == 3){
                                                            resolve(stdev_per_tool_per_nest);
                                                        }
                                                        
                                                    }
                                                }
                                            }
                                    });

                                });
                            }

                            toCloudDB().then(function(inserted){
                                return querySTDev().then(function(stdev){
                                    io.volatile.emit('NTM_STD', stdev);
                                    return queryEachSTDev().then(function(stdev_per_tool){
                                        io.volatile.emit([data_arr[1]]+'_STD',  stdev_per_tool);
                                        return queryEachNestToNestSTDev().then(function(stdev_per_tool_per_nest){
                                            io.volatile.emit([data_arr[1]]+'_STD_NEST_PER_TOOL',  stdev_per_tool_per_nest);
                                        });
                                        connection.release();
                                    });
                                });
                            });
                        
                        });
                        
                    });

                });
        
                tail.on('error', function(error){
                    console.log(error);
                });
            }
        });
        
        fs.watch(pathToFolder, (eventType, filename) => {
            if(`${eventType}` == 'rename'){

                fs.stat(pathToFolder + '\\' + moment(Date.now()).format('YYMMDD') + '_CMYK_PPDataLog.txt', function(err, stat){
                    if(err == null){
                        tail = new Tail(pathToFolder + '\\' + moment(Date.now()).format('YYMMDD') + '_CMYK_PPDataLog.txt');    
                        //console.log(tail);

                        tail.on('line', function(data){
                            let data_arr = [];
                            
                            function cleaner(){
                                return new Promise(function(resolve, reject){
                        
                                   //** start CLEANING log changes 
                                   let line = data.split('\r\n'); // remove \t
                                   line.map(function(item){
                                       let tabs = item.split('\t');
                                       
                                       let tab_Nest = tabs[3].split('\r\n'); // remove ;
                                       tab_Nest.map(function(item){
                                           let nest = item.split(';');
                                           //console.log(nest);
                           
                                           let nest_num = nest[0].split('\r\n'); // remove : @ nest
                                           let pressure_num = nest[1].split('\r\n');  // remove : @ pressure
                                           nest_num.map(function(item){
                                               let nest_val = item.split(':');
                                           ////console.log(nest_val[1]);
                                               
                                               pressure_num.map(function(item){
                                                   let pressure_val = item.split(':');
                                                   //console.log(pressure_val[1]);
                                                   let datetime = moment(new Date(tabs[0] + ' ' + tabs[1])).format();
                                                   
                                                   data_arr.push(datetime, logFile_obj.ntm.tool_name[j], tabs[2], nest_val[1].replace(/ /g, ''), pressure_val[1].replace(/ /g, ''), 'NTM');
                           
                                                   resolve(data_arr);
                                               //console.log(data_arr);
                                                   //** end of CLEANING log changes
                                               });
                                           });
                                       });
                                   });
                        
                                });
                            }
                            
                            cleaner().then(function(data_arr){
                           
                                io.volatile.emit(logFile_obj.ntm.tool_name[j] + '_client', data_arr);
                                
                                mysqlCloud.poolCloud.getConnection(function(err, connection){

                                    function toCloudDB(){
                                        return new Promise(function(resolve, reject){
        
                                            connection.query({
                                                sql: 'INSERT INTO tbl_patterning_cmyk_logs SET date_time =?, tool_name =?, log_type=?, nest=?, pressure=?, process=?',
                                                values: [data_arr[0], data_arr[1], data_arr[2], data_arr[3], data_arr[4], data_arr[5]]
                                            },  function(err, results, fields){
                                                resolve('inserted');
                                            });
        
                                        });
        
                                    }
        
                                    function querySTDev(){
                                        return new Promise(function(resolve, reject){
                                            let dateToday = moment(new Date()).format('YYYY-MM-DD');
                                            
                                            connection.query({
                                                sql: 'SELECT STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE process = "NTM" AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59")',
                                                values: [dateToday, dateToday]
                                            }, function(err, results, fields){
                                            
                                                if(results){
                                                    if(typeof results[0] != 'undefined' && results[0] != null && results.length > 0){
                                                        let stdev = (results[0].STD_pressure).toFixed(4);
                                                        resolve(stdev);
                                                    } else {
                                                        reject('error in querySTDEV NTM');
                                                    }
                                                }
                                                
                                            });
        
                                        });
                                    }
        
                                    function queryEachSTDev(){
                                        return new Promise(function(resolve, reject){
                                            let dateToday = moment(new Date()).format('YYYY-MM-DD');
        
                                            connection.query({
                                                sql: 'SELECT STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE tool_name=? AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59")',
                                                values: [data_arr[1], dateToday, dateToday]
                                            }, function(err, results, fields){

                                                if(results){
                                                    if(typeof results[0] != 'undefined' && results[0] != null && results.length > 0){
                                                        let stdev_per_tool = (results[0].STD_pressure).toFixed(4);
                                                        resolve(stdev_per_tool);
                                                    } else {
                                                        reject('error in queryEachSTDev NTM');
                                                    }
                                                }
                                                
                                            });
                                            
                                        });
                                    }

                                    function queryEachNestToNestSTDev(){ // nest to nest
                                        return new Promise(function(resolve, reject){
                                            let dateToday = moment(new Date()).format('YYYY-MM-DD');
                                            
                                            connection.query({
                                                sql: 'SELECT tool_name, nest, STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE tool_name=? AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59") GROUP BY nest',
                                                values: [data_arr[1], dateToday, dateToday]
                                            },  function(err, results, fields){
                                                    if(results){
                                                        if(typeof results[0] != 'undefined' && results[0] != null && results.length >0){
                                                            
                                                            let stdev_per_tool_per_nest = [];
        
                                                            for(let i = 0; i <results.length; i++){
        
                                                                stdev_per_tool_per_nest.push({
                                                                    tool_name: results[i].tool_name,
                                                                    nest: results[i].nest,
                                                                    stdev: results[i].STD_pressure
                                                                });
                                                                
                                                                if(i == 3){
                                                                    resolve(stdev_per_tool_per_nest);
                                                                }
                                                                
                                                            }
                                                        }
                                                    }
                                            });
        
                                        });
                                    }
        
                                    toCloudDB().then(function(inserted){
                                        return querySTDev().then(function(stdev){
                                            io.volatile.emit('NTM_STD', stdev);
                                            return queryEachSTDev().then(function(stdev_per_tool){
                                                io.volatile.emit([data_arr[1]]+'_STD',  stdev_per_tool);
                                                return queryEachNestToNestSTDev().then(function(stdev_per_tool_per_nest){
                                                    io.volatile.emit([data_arr[1]]+'_STD_NEST_PER_TOOL',  stdev_per_tool_per_nest);
                                                });
                                                connection.release();
                                            });
                                        });
                                    });
                                
                                });

                            });
                            
                        });
                
                        tail.on('error', function(error){
                            console.log(error);
                        });
                    }
                });
                
            }
        });
        
    }
    
    for(let j=0; j<logFile_obj.ptm.tool_name.length; j++){ // PTM tools
        let pathToFolder = ptm_FileFolder + logFile_obj.ptm.tool_name[j];
        let pathToLog = pathToFolder + '\\' + moment(Date.now()).format('YYMMDD') + '_CMYK_PPDataLog.txt';

        fs.stat(pathToLog, function(err, stat){
            if(err == null){
                tail = new Tail(pathToLog);
                tail.on('line', function(data){
                    let data_arr = [];
        
                    function cleaner(){
                        return new Promise(function(resolve, reject){
                
                           //** start CLEANING log changes 
                           let line = data.split('\r\n'); // remove \t
                           line.map(function(item){
                               let tabs = item.split('\t');
                               
                               let tab_Nest = tabs[3].split('\r\n'); // remove ;
                               tab_Nest.map(function(item){
                                   let nest = item.split(';');
                                   //console.log(nest);
                   
                                   let nest_num = nest[0].split('\r\n'); // remove : @ nest
                                   let pressure_num = nest[1].split('\r\n');  // remove : @ pressure
                                   nest_num.map(function(item){
                                       let nest_val = item.split(':');
                                   ////console.log(nest_val[1]);
                                       
                                       pressure_num.map(function(item){
                                           let pressure_val = item.split(':');
                                           //console.log(pressure_val[1]);
                                           let datetime = moment(new Date(tabs[0] + ' ' + tabs[1])).format();
                                           
                                           data_arr.push(datetime, logFile_obj.ptm.tool_name[j], tabs[2], nest_val[1].replace(/ /g, ''), pressure_val[1].replace(/ /g, ''), 'PTM');
                   
                                           resolve(data_arr);
                                       //console.log(data_arr);
                                           //** end of CLEANING log changes
                                       });
                                   });
                               });
                           });
                
                        });
                    }
                    
                    cleaner().then(function(data_arr){
                   
                        io.volatile.emit(logFile_obj.ptm.tool_name[j] + '_client', data_arr);
                        
                        mysqlCloud.poolCloud.getConnection(function(err, connection){

                            function toCloudDB(){
                                return new Promise(function(resolve, reject){

                                    connection.query({
                                        sql: 'INSERT INTO tbl_patterning_cmyk_logs SET date_time =?, tool_name =?, log_type=?, nest=?, pressure=?, process=?',
                                        values: [data_arr[0], data_arr[1], data_arr[2], data_arr[3], data_arr[4], data_arr[5]]
                                    },  function(err, results, fields){
                                        resolve('inserted');
                                    });

                                });

                            }

                            function querySTDev(){
                                return new Promise(function(resolve, reject){
                                    let dateToday = moment(new Date()).format('YYYY-MM-DD');
                                    
                                    connection.query({
                                        sql: 'SELECT STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE process = "PTM" AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59")',
                                        values: [dateToday, dateToday]
                                    }, function(err, results, fields){

                                        if(results){
                                            if(typeof results[0] != 'undefined' && results[0] != null && results.length > 0){
                                                let stdev = (results[0].STD_pressure).toFixed(4);
                                                resolve(stdev);
                                            } else {
                                                reject('error in querySTDEV PTM');
                                            }
                                        }
                                        
                                    });

                                });
                            }

                            function queryEachSTDev(){
                                return new Promise(function(resolve, reject){
                                    let dateToday = moment(new Date()).format('YYYY-MM-DD');

                                    connection.query({
                                        sql: 'SELECT STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE tool_name=? AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59")',
                                        values: [data_arr[1], dateToday, dateToday]
                                    }, function(err, results, fields){

                                        if(results){
                                            if(typeof results[0] != 'undefined' && results[0] != null && results.length > 0){
                                                let stdev_per_tool = (results[0].STD_pressure).toFixed(4);
                                                resolve(stdev_per_tool);
                                            } else {
                                                reject('error in queryEachSTDev PTM');
                                            }
                                        }
                                        
                                    });
                                    
                                });
                            }

                            function queryEachNestToNestSTDev(){ // nest to nest
                                return new Promise(function(resolve, reject){
                                    let dateToday = moment(new Date()).format('YYYY-MM-DD');
                                    
                                    connection.query({
                                        sql: 'SELECT tool_name, nest, STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE tool_name=? AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59") GROUP BY nest',
                                        values: [data_arr[1], dateToday, dateToday]
                                    },  function(err, results, fields){
                                            if(results){
                                                if(typeof results[0] != 'undefined' && results[0] != null && results.length >0){
                                                    
                                                    let stdev_per_tool_per_nest = [];

                                                    for(let i = 0; i <results.length; i++){

                                                        stdev_per_tool_per_nest.push({
                                                            tool_name: results[i].tool_name,
                                                            nest: results[i].nest,
                                                            stdev: results[i].STD_pressure
                                                        });
                                                        
                                                        if(i == 3){
                                                            resolve(stdev_per_tool_per_nest);
                                                        }
                                                        
                                                    }
                                                }
                                            }
                                    });

                                });
                            }

                            toCloudDB().then(function(inserted){
                                return querySTDev().then(function(stdev){
                                    io.volatile.emit('PTM_STD', stdev);
                                    return queryEachSTDev().then(function(stdev_per_tool){
                                        io.volatile.emit([data_arr[1]]+'_STD',  stdev_per_tool);
                                        return queryEachNestToNestSTDev().then(function(stdev_per_tool_per_nest){
                                            io.volatile.emit([data_arr[1]]+'_STD_NEST_PER_TOOL',  stdev_per_tool_per_nest);
                                        });
                                        connection.release();
                                    });
                                });
                            });
                        
                        });

                    });
                });
        
                tail.on('error', function(error){
                    console.log(error);
                });
            }
        });
        
        fs.watch(pathToFolder, (eventType, filename) => {
            if(`${eventType}` == 'rename'){

                fs.stat(pathToFolder + '\\' + moment(Date.now()).format('YYMMDD') + '_CMYK_PPDataLog.txt', function(err, stat){

                    if(err == null){
                        tail = new Tail(pathToFolder + '\\' + moment(Date.now()).format('YYMMDD') + '_CMYK_PPDataLog.txt');    
                        //console.log(tail);

                        tail.on('line', function(data){
                            let data_arr = [];
                
                            function cleaner(){
                                return new Promise(function(resolve, reject){
                        
                                   //** start CLEANING log changes 
                                   let line = data.split('\r\n'); // remove \t
                                   line.map(function(item){
                                       let tabs = item.split('\t');
                                       
                                       let tab_Nest = tabs[3].split('\r\n'); // remove ;
                                       tab_Nest.map(function(item){
                                           let nest = item.split(';');
                                           //console.log(nest);
                           
                                           let nest_num = nest[0].split('\r\n'); // remove : @ nest
                                           let pressure_num = nest[1].split('\r\n');  // remove : @ pressure
                                           nest_num.map(function(item){
                                               let nest_val = item.split(':');
                                           ////console.log(nest_val[1]);
                                               
                                               pressure_num.map(function(item){
                                                   let pressure_val = item.split(':');
                                                   //console.log(pressure_val[1]);
                                                   let datetime = moment(new Date(tabs[0] + ' ' + tabs[1])).format();
                                                   
                                                   data_arr.push(datetime, logFile_obj.ptm.tool_name[j], tabs[2], nest_val[1].replace(/ /g, ''), pressure_val[1].replace(/ /g, ''), 'PTM');
                           
                                                   resolve(data_arr);
                                               //console.log(data_arr);
                                                   //** end of CLEANING log changes
                                               });
                                           });
                                       });
                                   });
                        
                                });
                            }
                            
                            cleaner().then(function(data_arr){
                           
                                io.volatile.emit(logFile_obj.ptm.tool_name[j] + '_client', data_arr);
                                
                                mysqlCloud.poolCloud.getConnection(function(err, connection){

                                    function toCloudDB(){
                                        return new Promise(function(resolve, reject){
        
                                            connection.query({
                                                sql: 'INSERT INTO tbl_patterning_cmyk_logs SET date_time =?, tool_name =?, log_type=?, nest=?, pressure=?, process=?',
                                                values: [data_arr[0], data_arr[1], data_arr[2], data_arr[3], data_arr[4], data_arr[5]]
                                            },  function(err, results, fields){
                                                resolve('inserted');
                                            });
        
                                        });
        
                                    }
        
                                    function querySTDev(){
                                        return new Promise(function(resolve, reject){
                                            let dateToday = moment(new Date()).format('YYYY-MM-DD');
                                            
                                            connection.query({
                                                sql: 'SELECT STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE process = "PTM" AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59")',
                                                values: [dateToday, dateToday]
                                            }, function(err, results, fields){

                                                if(results){
                                                    if(typeof results[0] != 'undefined' && results[0] != null && results.length > 0){
                                                        let stdev = (results[0].STD_pressure).toFixed(4);
                                                        resolve(stdev);
                                                    } else {
                                                        reject('error in querySTDEV PTM');
                                                    }
                                                }
                                                
                                            });
        
                                        });
                                    }
        
                                    function queryEachSTDev(){
                                        return new Promise(function(resolve, reject){
                                            let dateToday = moment(new Date()).format('YYYY-MM-DD');
        
                                            connection.query({
                                                sql: 'SELECT STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE tool_name=? AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59")',
                                                values: [data_arr[1], dateToday, dateToday]
                                            }, function(err, results, fields){

                                                if(results){
                                                    if(typeof results[0] != 'undefined' && results[0] != null && results.length > 0){
                                                        let stdev_per_tool = (results[0].STD_pressure).toFixed(4);
                                                        resolve(stdev_per_tool);
                                                    } else {
                                                        reject('error in queryEachSTDev PTM');
                                                    }
                                                }
                                                
                                            });
                                            
                                        });
                                    }

                                    function queryEachNestToNestSTDev(){ // nest to nest
                                        return new Promise(function(resolve, reject){
                                            let dateToday = moment(new Date()).format('YYYY-MM-DD');
                                            
                                            connection.query({
                                                sql: 'SELECT tool_name, nest, STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE tool_name=? AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59") GROUP BY nest',
                                                values: [data_arr[1], dateToday, dateToday]
                                            },  function(err, results, fields){
                                                    if(results){
                                                        if(typeof results[0] != 'undefined' && results[0] != null && results.length >0){
                                                            
                                                            let stdev_per_tool_per_nest = [];
        
                                                            for(let i = 0; i <results.length; i++){
        
                                                                stdev_per_tool_per_nest.push({
                                                                    tool_name: results[i].tool_name,
                                                                    nest: results[i].nest,
                                                                    stdev: results[i].STD_pressure
                                                                });
                                                                
                                                                if(i == 3){
                                                                    resolve(stdev_per_tool_per_nest);
                                                                }
                                                                
                                                            }
                                                        }
                                                    }
                                            });
        
                                        });
                                    }
        
                                    toCloudDB().then(function(inserted){
                                        return querySTDev().then(function(stdev){
                                            io.volatile.emit('PTM_STD', stdev);
                                            return queryEachSTDev().then(function(stdev_per_tool){
                                                io.volatile.emit([data_arr[1]]+'_STD',  stdev_per_tool);
                                                return queryEachNestToNestSTDev().then(function(stdev_per_tool_per_nest){
                                                    io.volatile.emit([data_arr[1]]+'_STD_NEST_PER_TOOL',  stdev_per_tool_per_nest);
                                                });
                                                connection.release();
                                            });
                                        });
                                    });
                                
                                });

                            });
                        });
                
                        tail.on('error', function(error){
                            console.log(error);
                        });
                        
                    }
                });

            }
        });
        
        
    }

    for(let j=0; j<logFile_obj.plm.tool_name.length; j++){ // PLM tools
        let pathToFolder = plm_FileFolder + logFile_obj.plm.tool_name[j];
        let pathToLog = pathToFolder + '\\' + moment(Date.now()).format('YYMMDD') + '_CMYK_PPDataLog.txt';

        fs.stat(pathToLog, function(err, stat){

            if(err == null){
                
                tail = new Tail(pathToLog);
                tail.on('line', function(data){
                    let data_arr = [];
        
                    function cleaner(){
                        return new Promise(function(resolve, reject){
                
                           //** start CLEANING log changes 
                           let line = data.split('\r\n'); // remove \t
                           line.map(function(item){
                               let tabs = item.split('\t');
                               
                               let tab_Nest = tabs[3].split('\r\n'); // remove ;
                               tab_Nest.map(function(item){
                                   let nest = item.split(';');
                                   //console.log(nest);
                   
                                   let nest_num = nest[0].split('\r\n'); // remove : @ nest
                                   let pressure_num = nest[1].split('\r\n');  // remove : @ pressure
                                   nest_num.map(function(item){
                                       let nest_val = item.split(':');
                                   ////console.log(nest_val[1]);
                                       
                                       pressure_num.map(function(item){
                                           let pressure_val = item.split(':');
                                           //console.log(pressure_val[1]);
                                           let datetime = moment(new Date(tabs[0] + ' ' + tabs[1])).format();
                                           
                                           data_arr.push(datetime, logFile_obj.plm.tool_name[j], tabs[2], nest_val[1].replace(/ /g, ''), pressure_val[1].replace(/ /g, ''), 'PLM');
                   
                                           resolve(data_arr);
                                       //console.log(data_arr);
                                           //** end of CLEANING log changes
                                       });
                                   });
                               });
                           });
                
                        });
                    }
                    
                    cleaner().then(function(data_arr){
                   
                        io.volatile.emit(logFile_obj.plm.tool_name[j] + '_client', data_arr);
                        
                        mysqlCloud.poolCloud.getConnection(function(err, connection){

                            function toCloudDB(){
                                return new Promise(function(resolve, reject){

                                    connection.query({
                                        sql: 'INSERT INTO tbl_patterning_cmyk_logs SET date_time =?, tool_name =?, log_type=?, nest=?, pressure=?, process=?',
                                        values: [data_arr[0], data_arr[1], data_arr[2], data_arr[3], data_arr[4], data_arr[5]]
                                    },  function(err, results, fields){
                                        resolve('inserted');
                                    });

                                });

                            }

                            function querySTDev(){
                                return new Promise(function(resolve, reject){
                                    let dateToday = moment(new Date()).format('YYYY-MM-DD');
                                    
                                    connection.query({
                                        sql: 'SELECT STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE process = "PLM" AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59")',
                                        values: [dateToday, dateToday]
                                    }, function(err, results, fields){

                                        if(results){
                                            if(typeof results[0] != 'undefined' && results[0] != null && results.length > 0){
                                                let stdev = (results[0].STD_pressure).toFixed(4);
                                                resolve(stdev);
                                            } else {
                                                reject('error in querySTDEV PLM');
                                            }
                                        }
                                        
                                    });

                                });
                            }

                            function queryEachSTDev(){
                                return new Promise(function(resolve, reject){
                                    let dateToday = moment(new Date()).format('YYYY-MM-DD');

                                    connection.query({
                                        sql: 'SELECT STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE tool_name=? AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59")',
                                        values: [data_arr[1], dateToday, dateToday]
                                    }, function(err, results, fields){

                                        if(results){
                                            if(typeof results[0] != 'undefined' && results[0] != null && results.length > 0){
                                                let stdev_per_tool = (results[0].STD_pressure).toFixed(4);
                                                resolve(stdev_per_tool);
                                            } else {
                                                reject('error in queryEachSTDev PLM');
                                            }
                                        }
                                        
                                    });
                                    
                                });
                            }

                            function queryEachNestToNestSTDev(){ // nest to nest
                                return new Promise(function(resolve, reject){
                                    let dateToday = moment(new Date()).format('YYYY-MM-DD');
                                    
                                    connection.query({
                                        sql: 'SELECT tool_name, nest, STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE tool_name=? AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59") GROUP BY nest',
                                        values: [data_arr[1], dateToday, dateToday]
                                    },  function(err, results, fields){
                                            if(results){
                                                if(typeof results[0] != 'undefined' && results[0] != null && results.length >0){
                                                    
                                                    let stdev_per_tool_per_nest = [];

                                                    for(let i = 0; i <results.length; i++){

                                                        stdev_per_tool_per_nest.push({
                                                            tool_name: results[i].tool_name,
                                                            nest: results[i].nest,
                                                            stdev: results[i].STD_pressure
                                                        });
                                                        
                                                        if(i == 3){
                                                            resolve(stdev_per_tool_per_nest);
                                                        }
                                                        
                                                    }
                                                }
                                            }
                                    });

                                });
                            }

                            toCloudDB().then(function(inserted){
                                return querySTDev().then(function(stdev){
                                    io.volatile.emit('PLM_STD', stdev);
                                    return queryEachSTDev().then(function(stdev_per_tool){
                                        io.volatile.emit([data_arr[1]]+'_STD',  stdev_per_tool);
                                        return queryEachNestToNestSTDev().then(function(stdev_per_tool_per_nest){
                                            io.volatile.emit([data_arr[1]]+'_STD_NEST_PER_TOOL',  stdev_per_tool_per_nest);
                                        });
                                        connection.release();
                                    });
                                });
                            });
                        
                        });

                    });
                });
        
                tail.on('error', function(error){
                    console.log(error);
                });
            }

        });
        
        fs.watch(pathToFolder, (eventType, filename) => {
            if(`${eventType}` == 'rename'){

                fs.stat(pathToFolder + '\\' + moment(Date.now()).format('YYMMDD') + '_CMYK_PPDataLog.txt', function(err, stat){
                    
                    if(err == null){

                        tail = new Tail(pathToFolder + '\\' + moment(Date.now()).format('YYMMDD') + '_CMYK_PPDataLog.txt');    
                        //console.log(tail);
                        tail.on('line', function(data){
                            let data_arr = [];
                
                            function cleaner(){
                                return new Promise(function(resolve, reject){
                        
                                   //** start CLEANING log changes 
                                   let line = data.split('\r\n'); // remove \t
                                   line.map(function(item){
                                       let tabs = item.split('\t');
                                       
                                       let tab_Nest = tabs[3].split('\r\n'); // remove ;
                                       tab_Nest.map(function(item){
                                           let nest = item.split(';');
                                           //console.log(nest);
                           
                                           let nest_num = nest[0].split('\r\n'); // remove : @ nest
                                           let pressure_num = nest[1].split('\r\n');  // remove : @ pressure
                                           nest_num.map(function(item){
                                               let nest_val = item.split(':');
                                           ////console.log(nest_val[1]);
                                               
                                               pressure_num.map(function(item){
                                                   let pressure_val = item.split(':');
                                                   //console.log(pressure_val[1]);
                                                   let datetime = moment(new Date(tabs[0] + ' ' + tabs[1])).format();
                                                   
                                                   data_arr.push(datetime, logFile_obj.plm.tool_name[j], tabs[2], nest_val[1].replace(/ /g, ''), pressure_val[1].replace(/ /g, ''), 'PLM');
                           
                                                   resolve(data_arr);
                                               //console.log(data_arr);
                                                   //** end of CLEANING log changes
                                               });
                                           });
                                       });
                                   });
                        
                                });
                            }
                            
                            cleaner().then(function(data_arr){
                           
                                io.volatile.emit(logFile_obj.plm.tool_name[j] + '_client', data_arr);
                                
                                mysqlCloud.poolCloud.getConnection(function(err, connection){

                                    function toCloudDB(){
                                        return new Promise(function(resolve, reject){
        
                                            connection.query({
                                                sql: 'INSERT INTO tbl_patterning_cmyk_logs SET date_time =?, tool_name =?, log_type=?, nest=?, pressure=?, process=?',
                                                values: [data_arr[0], data_arr[1], data_arr[2], data_arr[3], data_arr[4], data_arr[5]]
                                            },  function(err, results, fields){
                                                resolve('inserted');
                                            });
        
                                        });
        
                                    }
        
                                    function querySTDev(){
                                        return new Promise(function(resolve, reject){
                                            let dateToday = moment(new Date()).format('YYYY-MM-DD');
                                            
                                            connection.query({
                                                sql: 'SELECT STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE process = "PLM" AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59")',
                                                values: [dateToday, dateToday]
                                            }, function(err, results, fields){

                                                if(results){
                                                    if(typeof results[0] != 'undefined' && results[0] != null && results.length > 0){
                                                        let stdev = (results[0].STD_pressure).toFixed(4);
                                                        resolve(stdev);
                                                    } else {
                                                        reject('error in querySTDEV PLM');
                                                    }
                                                }
                                                
                                            });
        
                                        });
                                    }
        
                                    function queryEachSTDev(){
                                        return new Promise(function(resolve, reject){
                                            let dateToday = moment(new Date()).format('YYYY-MM-DD');
        
                                            connection.query({
                                                sql: 'SELECT STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE tool_name=? AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59")',
                                                values: [data_arr[1], dateToday, dateToday]
                                            }, function(err, results, fields){

                                                if(results){
                                                    if(typeof results[0] != 'undefined' && results[0] != null && results.length > 0){
                                                        let stdev_per_tool = (results[0].STD_pressure).toFixed(4);
                                                        resolve(stdev_per_tool);
                                                    } else {
                                                        reject('error in queryEachSTDev PLM');
                                                    }
                                                }
                                                
                                            });
                                            
                                        });
                                    }

                                    function queryEachNestToNestSTDev(){ // nest to nest
                                        return new Promise(function(resolve, reject){
                                            let dateToday = moment(new Date()).format('YYYY-MM-DD');
                                            
                                            connection.query({
                                                sql: 'SELECT tool_name, nest, STD(pressure) as STD_pressure FROM fab4_apps_db.tbl_patterning_cmyk_logs WHERE tool_name=? AND date_time >= CONCAT(?," 00:00:00") && date_time <= CONCAT(?," 23:59:59") GROUP BY nest',
                                                values: [data_arr[1], dateToday, dateToday]
                                            },  function(err, results, fields){
                                                    if(results){
                                                        if(typeof results[0] != 'undefined' && results[0] != null && results.length >0){
                                                            
                                                            let stdev_per_tool_per_nest = [];
        
                                                            for(let i = 0; i <results.length; i++){
        
                                                                stdev_per_tool_per_nest.push({
                                                                    tool_name: results[i].tool_name,
                                                                    nest: results[i].nest,
                                                                    stdev: results[i].STD_pressure
                                                                });
                                                                
                                                                if(i == 3){
                                                                    resolve(stdev_per_tool_per_nest);
                                                                }
                                                                
                                                            }
                                                        }
                                                    }
                                            });
        
                                        });
                                    }
        
                                    toCloudDB().then(function(inserted){
                                        return querySTDev().then(function(stdev){
                                            io.volatile.emit('PLM_STD', stdev);
                                            return queryEachSTDev().then(function(stdev_per_tool){
                                                io.volatile.emit([data_arr[1]]+'_STD',  stdev_per_tool);
                                                return queryEachNestToNestSTDev().then(function(stdev_per_tool_per_nest){
                                                    io.volatile.emit([data_arr[1]]+'_STD_NEST_PER_TOOL',  stdev_per_tool_per_nest);
                                                });
                                                connection.release();
                                            });
                                        });
                                    });
                                
                                });

                            });
                        });
                
                        tail.on('error', function(error){
                            console.log(error);
                        });
                        
                    }

                });

            }
        });
        
    }
    
}