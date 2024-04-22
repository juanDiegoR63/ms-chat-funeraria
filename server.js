const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

// instanciar express
const app = express();
app.use(express.json()); // Asegúrate de que Express pueda manejar el cuerpo JSON

// crear el servidor web
const server = http.createServer(app);

// configuración del servidor con las cors
const io = socketIo(server, {
  cors: {
    origin: "http://127.0.0.1:5500",
    credentials: true,
  },
});

let users = {};
let codes = {};

app.get("/", (req, res) => {
  res.send("Server chat is running");
});


io.on("connection", (socket) => {
  console.log("An user connected");


  socket.on("join", (username, codigo, llave) => {
    console.log("join event received");
    if (!username) {
      console.log("Username is undefined");
      return;
    }


    console.log(`${username} joined the chat with socketId ${socket.id}`);
    users[socket.id] = username;

    console.log(`${username} joined the chat with code ${codigo}`);
    codes[socket.id] = codigo;

    const sql = `SELECT idusuario FROM usuario WHERE usuario = "${username}"`;
    conexion.query(sql, [username], (error, results, fields) => {
      if (error) {
        console.error("Error al ejecutar la consulta:", error);
        return;
      }

      // Verificar si se encontró algún resultado
      if (results.length > 0) {
        const usuarioid = results[0].usuarioid;
        console.log(`la id del usuario "${username}" es: ${usuarioid}`);
      } else {
        GuardarUsuario(username);
      }
    });
  });

  socket.on("message", (message) => {
    const user = users[socket.id];
    if (!user) {
      console.error("No user found for this socket id:", socket.id);
      return;
    }
    const code = codes[socket.id] || "defaultCode"; // Define un código por defecto si no existe

    isUserBlocked(socket.id, (err, blocked) => {
      if (err) {
        console.error("Error checking user block status:", err);
        return;
      }
      if (blocked) {
        socket.emit("blocked", "You are blocked from sending messages.");
        return;
      }

      const sql = `SELECT estado FROM usuario WHERE usuario = "${user}"`;
      conexion.query(sql, (error, results) => {
        if (error) {
          console.error("Error executing query:", error);
          return;
        }
        if (results.length > 0 && results[0].estado) {
          io.emit("message", { user, message, date: new Date() });
          const sql2 = `SELECT id FROM SalaChat WHERE codigoUnico = "${code}"`;
          conexion.query(sql2, (error, results) => {
            if (error) {
              console.error("Error executing query:", error);
              return;
            }
            if (results.length > 0) {
              const idsalachat = results[0].id;
              GuardarMensaje(user, message, new Date(), idsalachat);
            }
          });
        }
      });
    });
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
    console.log(`The user ${users[socket.id]} has left the chat.`);
    delete users[socket.id];
  });

  // crear el socket.on para cargar mensajes anteriores
  socket.on("loadMessages", () => {
    const codigo = codes[socket.id] || "Code";
    const sqlChat = `SELECT id FROM SalaChat WHERE codigoUnico = "${codigo}"`;
    conexion.query(sqlChat, [codigo], (error, results, fields) => {
      if (error) {
        console.error("Error al ejecutar la consulta:", error);
        return;
      }

      // Verificar si se encontró algún resultado
      if (results.length > 0) {
        const idsalachat = results[0].id;
        console.log(`El id del chat "${codigo}" es: ${idsalachat}`);
        CargarMensajes(idsalachat);
      }
    }
    );
  });

  socket.on("blockUser", ({ userToBlock, masterKey }) => {
    const codigo = codes[socket.id] || "Code";
    const sql = `SELECT llaveMaestra FROM SalaChat WHERE codigoUnico = "${codigo}"`;
    conexion.query(sql, (error, results) => {
      if (error) {
        console.error("Error al ejecutar la consulta:", error);
        return;
      } if (results.length > 0) {
        const llaveMaestra = results[0].llaveMaestra;
        if (masterKey == llaveMaestra) {  // Asegúrate de cambiar este valor por el método que elijas para validar la llave
          const sqlVerifyUser = `SELECT idusuario FROM usuario WHERE usuario = "${userToBlock}"`;
          conexion.query(sqlVerifyUser, (error, results) => {
            if (error) {
              console.error("Error al verificar el usuario a bloquear:", error);
              return;
            }

            if (results.length > 0) {
              const userIdToBlock = results[0].idusuario;
              const sqlFindChatRoom = `SELECT id FROM SalaChat WHERE codigoUnico = "${codigo}"`;

              conexion.query(sqlFindChatRoom, (error, results) => {
                if (error) {
                  console.error("Error al encontrar la sala de chat del usuario:", error);
                  return;
                }

                if (results.length > 0) {
                  const chatRoomId = results[0].id;
                  const sqlBlockUser = `INSERT INTO bloqueado (idsalachat, idusuario) VALUES (?, ?)`;
                  conexion.query(sqlBlockUser, [chatRoomId, userIdToBlock], (err, result) => {
                    if (err) {
                      console.error("Error al bloquear al usuario:", err);
                    } else {
                      console.log(`Usuario ${userToBlock} bloqueado exitosamente en la sala ${chatRoomId}`);
                    }
                  });
                }
              });
            } else {
              console.log("No se encontró el usuario a bloquear.");
            }
          });
        } else {
          console.log("Llave maestra incorrecta.");
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3010;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

let mysql = require("mysql");

let conexion = mysql.createConnection({
  host: "mysqlaws.cfauaecs6vva.us-east-1.rds.amazonaws.com",
  database: "funerariadb",
  user: "admin",
  password: "N0qC697G6C8O",
  port: 3306,
});

conexion.connect(function (err) {
  if (err) {
    throw err;
  } else {
    console.log("Conexión exitosa a la base de datos");
  }
});

// crear método para guardar los mensajes en la base de datos
function GuardarMensaje(username, message, date, idsalachat) {
  const sql1 = `SELECT idusuario FROM usuario WHERE usuario = "${username}"`;
  conexion.query(sql1, [username], (error, results, fields) => {
    if (error) {
      console.error("Error al ejecutar la consulta:", error);
      return;
    }

    // Verificar si se encontró algún resultado
    if (results.length > 0) {
      const sql =
        "INSERT INTO mensajes (usuario, mensaje, fechaHora, idusuario, idsalachat) VALUES (?, ?, ?, ?, ?)";
      const userId = results[0].idusuario;
      const values = [username, message, date, userId, idsalachat];
      console.log(`La ID del usuario "${username}" es: ${userId}`);
      conexion.query(sql, values, function (err, result) {
        if (err) {
          console.error(
            "Error al insertar el mensaje en la base de datos:",
            err
          );
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
  conexion.query(sql, [idsalachat], function (err, result) {
    if (err) {
      console.error("Error al cargar los mensajes del chat:", err);
    } else {
      // escribir los mensajes en pantalla
      for (let i = 0; i < result.length; i++) {
        io.emit("message", {
          user: result[i].usuario,
          message: result[i].mensaje,
          date: result[i].fechaHora,
        });
      }
      console.log("Mensajes cargados exitosamente");
    }
  });
}

function isUserBlocked(socketId, callback) {
  let user = users[socketId];
  let sql = `SELECT COUNT(*) AS isBlocked FROM bloqueado WHERE idSalaChat = ? AND idUsuario = (SELECT idusuario FROM usuario WHERE usuario = ?)`;

  conexion.query(sql, [codes[socketId], user], (error, results) => {
    if (error) {
      console.error("Error al verificar si el usuario está bloqueado:", error);
      callback(error, null);
      return;
    }
    callback(null, results[0].isBlocked > 0);
  });
}