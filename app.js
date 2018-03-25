let express = require('express');
let app = express();

let server = require('http').Server(app);
let io = require('socket.io')(server);


let apiController = require('./controllers/apiController');
let apiSocket = require('./controllers/apiSocket');

let port = process.env.PORT || 8000;

app.use('/', express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

apiController(app);
apiSocket(io);

server.listen(port);