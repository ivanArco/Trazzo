// Cambia los 'require' por 'import'
// Importa los módulos necesarios
// http es para crear el servidor HTTP, express es para manejar rutas y middleware, cors es para permitir solicitudes desde otros dominios, y dotenv es para cargar variables de entorno desde un archivo .env.
// express es un framework de Node.js que facilita la creación de aplicaciones web y APIs. Permite definir rutas, manejar solicitudes y respuestas, y usar middleware para procesar datos. En este caso, se utiliza para crear un servidor que responde a solicitudes HTTP y proporciona una API básica.
// cors es un middleware que permite que tu servidor acepte solicitudes desde otros dominios, lo cual es útil cuando tu frontend y backend están en diferentes dominios o puertos. Esto ayuda a evitar problemas de seguridad relacionados con el mismo origen (Same-Origin Policy).
// un middleware es una función que se ejecuta durante el ciclo de vida de una solicitud HTTP. Puede modificar la solicitud, la respuesta o finalizar el ciclo de solicitud-respuesta. En este caso, express.json() es un middleware que analiza las solicitudes entrantes con payload JSON y las convierte en objetos JavaScript accesibles a través de req.body.
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import 'dotenv/config'; // Esto carga automáticamente el archivo .env

const app = express();
app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.send('¡Hola, mundo!');
});


app.get ('/api', (req, res) => {
    res.json({ message: '¡Hola desde la API!' });
}); 


// Tu código del servidor...
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});


