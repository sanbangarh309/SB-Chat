//require is used to consume other node modules (located in node_modules dir, that was created when prompting 'npm install' in the command line)
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const mongoose = require('mongoose')
  , Schema = mongoose.Schema

//port can be set manually using the command line, for example "env PORT=8888 node index.js"
const port = process.env.PORT || 3000;
let num_users_online = [];
app.set('view engine', 'ejs')
/* DEFINE PATHES OF OUR SERVER: */
app.get('/', (req, res)=> {
    res.render('chat')
})

/*
 * may define more routes such as:
 * app.get('/saved_messages', function (req, res) {
 *   res.sendFile(__dirname + '/COMPLETE_THIS!.html');
 * });
*/

/*
 * enable using local files, stored in static folder, use this in index.html as:
 *
 * <script src="/static/hello_world.js"></script>
*/
app.use('/static', express.static(path.join(__dirname, 'static')))


// Create mongodb connection
mongoose.connect('mongodb://localhost:27017/chat-process', { useNewUrlParser: true, useUnifiedTopology: true }).then(() => {
    console.log('info', 'Successfully connect with mongoose DB');
}).catch((err) => {
    console.log('error', err);
});
// User Model created with only name for test urpose only
const UserModel = mongoose.model('User', Schema({
  name:{ type: String, required: true },
  created_at:{ type: Date, default: Date.now },
}))
// Message model created
const MessageModel = mongoose.model('Message', Schema({
  msg:{ type: String, required: true },
  sender_id: { type: Schema.Types.ObjectId, ref: 'User', default: Schema.Types.ObjectId },
  receiver_id: { type: Schema.Types.ObjectId, ref: 'User', default: Schema.Types.ObjectId },
  created_at:{ type: Date, default: Date.now },
}));

// Add user
const addUser = async (data) => {
  let user = await UserModel.findOneAndUpdate({ name: data.username }, { name: data.username }, { upsert: true, useFindAndModify: false });
  if (!user) {
    console.log('userrrr', user, Date.now)
    UserModel.update({ name: data.username }, { created_at: Date.now });
  }

}

// Add Message
const addMessage = (data) => {
  // {message: data.message, username: socket.username} sender_id: '', receiver_id: ''
  MessageModel.create({ msg: data.message }, function (err, message) {
    if (err) return handleError(err);
    // saved!
  });
}


// Fetch Users
app.get('/users', (req, res) => {
  UserModel.find({}, function(err, users) {
    res.status(200).json(users)
  }).sort({_id: -1})
})

// Fetch User Chat
app.get('/users/:id/chat', (req, res) => {
  console.log('req', req.params.id)
  let userId = req.params.id
  MessageModel.find({ $or:[ {'sender_id':userId}, {'receiver_id':userId} ]}, function(err, messages) {
    res.status(200).json(messages)
  })
})

//socket.io:
io.on('connection', function (socket) {
  //each socket is unique to each client that connects:
  console.log("socket.id: " + socket.id);

  //let the clients know how many online users are there:


  socket.on('username', function (username_from_client) {
    num_users_online.push(username_from_client);
    io.emit('updateNumUsersOnline', num_users_online);
    socket.username = username_from_client;
    addUser( { username: username_from_client } );
    //let all users know that this user has connected:
    io.emit('userConnected', socket.username);
  });

  //handle adding a message to the chat.
  socket.on('addChatMessage(client->server)', function (msg) {
    //io.emit(..., ...); - sending the message to all of the sockets.
    io.emit('addChatMessage(server->clients)', [socket.username, prepareMessageToClients(socket, msg)]);
  });

  //handle isTyping feature
  //istyping - key down
  socket.on('userIsTypingKeyDown(client->server)', function (undefined) {
    io.emit('userIsTypingKeyDown(server->clients)', [socket.username, prepareIsTypingToClients(socket)]);
  });

  //istyping - key up
  socket.on('userIsTypingKeyUp(client->server)', function (undefined) {
    io.emit('userIsTypingKeyUp(server->clients)', socket.username);
  });

  socket.on('disconnect', function () {
    io.emit('userDisconnected', socket.username);
    let userIndex = num_users_online.findIndex(obj => obj.name == socket.username )

    if (userIndex !== -1) num_users_online.splice(userIndex, 1)
    io.emit('updateNumUsersOnline', num_users_online);
  });
});


//start our server:
http.listen(port, function () {
  console.log('listening on localhost:' + port);
});

// -------------------------------------------------
function getParsedTime() {
  const date = new Date();

  let hour = date.getHours();
  hour = (hour < 10 ? "0" : "") + hour;

  let min = date.getMinutes();
  min = (min < 10 ? "0" : "") + min;

  return (hour + ":" + min);
}

// Prepare the message that will be sent to all of the clients
function prepareMessageToClients(socket, msg) {
  return ('<li>' + getParsedTime() + ' <strong>' + socket.username + '</strong>: ' + msg + '</li>');
}

//prepare the '___ is typing...' message
function prepareIsTypingToClients(socket) {
  return ('<li><strong>' + socket.username + '</strong> is typing...</li>')
}
