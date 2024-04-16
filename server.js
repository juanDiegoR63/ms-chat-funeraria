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
        GuardarUsuario(username);
        CargarMensajes(1);
    });

    socket.on("message", (message) => {
        const user = users[socket.id] || "User";
        io.emit("message", { user, message, date: new Date() });
        GuardarMensaje(user, message, new Date(), 1);
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

// crear el socket.on para cargar mensajes anteriores
    socket.on("loadMessages", () => {
        CargarMensajes(1);
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
function GuardarMensaje(username, message, date, idsalachat) {
    const sql1 = `SELECT idusuario FROM usuario WHERE usuario = "${username}"`;
    conexion.query(sql1, [username], (error, results, fields) => {
        if (error) {
            console.error('Error al ejecutar la consulta:', error);
            return;
        }

        // Verificar si se encontró algún resultado
        if (results.length > 0) {
            const sql = "INSERT INTO mensajes (usuario, mensaje, fechaHora, idusuario, idsalachat) VALUES (?, ?, ?, ?, ?)";
            const userId = results[0].idusuario;
            const values = [username, message, date, userId, idsalachat];
            console.log(`La ID del usuario "${username}" es: ${userId}`);
            conexion.query(sql, values, function (err, result) {
                if (err) {
                    console.error("Error al insertar el mensaje en la base de datos:", err);
                } else {
                    console.log("Mensaje almacenado en la base de datos");
                }
            });
        } else {
            console.log(`No se encontró ningún usuario con el nombre "${username}"`);
        }
    });

}
// crear metodo para guardar los usuarios en la base de datos
function GuardarUsuario(username) {
    const sql = "INSERT INTO usuario (usuario, estado) VALUES (?, ?)";
    const values = [username, true];
    conexion.query(sql, values, function (err, result) {
        if (err) {
            console.error("Error al insertar el usuario en la base de datos:", err);
        } else {
            console.log("Usuario almacenado en la base de datos");
        }
    });
}

// crear una funcion para cargar los mensajes almacenados del chat especifico
function CargarMensajes(idsalachat) {
    const sql = `SELECT usuario, mensaje, fechaHora FROM mensajes WHERE idsalachat = ${idsalachat}`;
    conexion.query(sql, function (err, result) {
        if (err) {
            console.error("Error al cargar los mensajes del chat:", err);
        } else {
            console.log("Mensajes cargados exitosamente");
            // escribir los mensajes en pantalla
            for (let i = 0; i < result.length; i++) {
                io.emit("message", { user: result[i].usuario, message: result[i].mensaje, date: result[i].fechaHora });
            }
        }
    });
}