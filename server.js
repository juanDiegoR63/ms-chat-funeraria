const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require('cors');

// instanciar express
const app = express();

// crear el servidor web
const server = http.createServer(app);

// configuración del servidor con las cors
const io = socketIo(server, {
    cors: {
        origin: "http://127.0.0.1:5500",
        credentials: true
    }
});


let users = {};

app.get("/", (req, res) => {
    res.send("Server chat is running");
});

io.on("connection", (socket) => {
    console.log("An user connected");

    socket.on("join", (username) => {
        console.log(`${username} joined the chat with socketId ${socket.id}`)
        users[socket.id] = username;
    });

    socket.on("message", (message) => {
        const user = users[socket.id] || "User";
        io.emit("message", { user, message, date: new Date()});
        GuardarMensaje(user, message, new Date());
    });

    socket.on("privateMessage", (data) => {
        const user = users[socket.id] || "User";
        const recipientSocket = Object.keys(users).find(
            (socketId) => users[socketId] === data.recipient
        );
        if (recipientSocket) {
            io.to(recipientSocket).emit("privateMessage", {
                user,
                recipient: data.recipient,
                message: data.message,
            });
        }
    });

    socket.on("disconnect", () => {
        console.log(`The user ${users[socket.id]} has left the chat.`)
        delete users[socket.id];
    });
});

const PORT = process.env.PORT || 3010;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

let mysql = require('mysql');


let conexion = mysql.createConnection({
    host: "mysqlaws.cfauaecs6vva.us-east-1.rds.amazonaws.com",
    database: "chat",
    user: "admin",
    password: "N0qC697G6C8O",
    port: 3306
});

conexion.connect(function (err) {
    if (err) {
        throw (err);
    } else {
        console.log("Conexión exitosa a la base de datos");
    }
});

// crear método para guardar los mensajes en la base de datos
function GuardarMensaje(username, message, date) {
    const sql = "INSERT INTO mensajes (usuario, mensaje, fechaHora) VALUES (?, ?, ?)";
    const values = [username, message, date];
    conexion.query(sql, values, function (err, result) {
        if (err) {
            console.error("Error al insertar el mensaje en la base de datos:", err);
        } else {
            console.log("Mensaje almacenado en la base de datos");
        }
    });
}
