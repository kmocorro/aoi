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
                                           
                                           data_arr.push(datetime, logFile_obj.ntm.tool_name[j], tabs[2], nest_val[1].replace(/ /g, ''), pressure_val[1].replace(/ /g, ''));
                   
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
                                                   
                                                   data_arr.push(datetime, logFile_obj.ntm.tool_name[j], tabs[2], nest_val[1].replace(/ /g, ''), pressure_val[1].replace(/ /g, ''));
                           
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
                                
                            });
                            
                        });
                
                        tail.on('error', function(error){
                            console.log(error);
                        });
                    } else {
                        console.log(pathToFolder + '\\' + moment(Date.now()).format('YYMMDD') + '_CMYK_PPDataLog.txt is missing');
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
                                           
                                           data_arr.push(datetime, logFile_obj.ptm.tool_name[j], tabs[2], nest_val[1].replace(/ /g, ''), pressure_val[1].replace(/ /g, ''));
                   
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
                                                   
                                                   data_arr.push(datetime, logFile_obj.ptm.tool_name[j], tabs[2], nest_val[1].replace(/ /g, ''), pressure_val[1].replace(/ /g, ''));
                           
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
                                           
                                           data_arr.push(datetime, logFile_obj.plm.tool_name[j], tabs[2], nest_val[1].replace(/ /g, ''), pressure_val[1].replace(/ /g, ''));
                   
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
                                                   
                                                   data_arr.push(datetime, logFile_obj.plm.tool_name[j], tabs[2], nest_val[1].replace(/ /g, ''), pressure_val[1].replace(/ /g, ''));
                           
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