const express = require('express');
const bodyparser = require('body-parser');
const fs = require('fs');
const OAuth2Server = require('oauth2-server');
const cors = require('cors');
const path = require('path');

const ex = express();
ex.use(bodyparser.urlencoded({extended: true}));
ex.use(bodyparser.json({type: ['application/json', 'text/plain']}));
ex.use(cors());

ex.oauth = new OAuth2Server ({ 
        model: require('./model'), 
        accessTokenLifetime: 3600, 
        allowBearerTokensInQueryString: true
    });


function autenticacion(request, response, next) 
    {   
        const req = new OAuth2Server.Request(request);
        const res = new OAuth2Server.Response(response); 
        ex.oauth.authenticate(req, res) 
            .then((token) => 
                { 
                    request.user = token.user; 
                    next(); 
                }
                )
            .catch((err) => { response.status(401).json({error: 'Acceso denegado'}); });
        }
ex.get('/datos-publicos', (req, res) => { 
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'datos-publicos.json'), 'utf8'));
    console.log(req.headers);
    console.log('Get Recibido');
    res.json(data[1].data1);}
    );
            
/*
ex.get('/datos-publicos', (req, res) => {
    console.log(req.headers);
    console.log('Get Recibido');
    res.setHeader('Content-Type', 'text/plain');

    res.send('HOLA');

});
*/

ex.get('/datos-privados', autenticacion, (req, res) => { 
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'datos-privados.json'), 'utf8'));
    res.json(data[1].data1);}
);

ex.post('/datos-privados', autenticacion, (req, res) => { 
    const rutaArchivo = path.join(__dirname, 'datos-privados.json');

    try {
        let db = JSON.parse(fs.readFileSync(rutaArchivo, 'utf8'));
        nuevo = {
            id: req.headers.id_pieza,
            vs_inspection: req.headers.vs_inspection,
            electrical_test: req.headers.electrical_test,
            tiempo_ciclo: req.headers.cycle_total
        };
        console.log(nuevo)
        
        db['NuevoRegistro'].push(nuevo) 
        
        fs.writeFileSync(rutaArchivo, JSON.stringify(db, null, 2));
        res.status(201).json({ mensaje: "Guardado con éxito", dato: nuevo });
    } catch (err) {
        console.log(err.message)
        res.status(500).json({ error: "No se pudo escribir el archivo"});
    }
});

ex.post('/datos-publicos', (req, res) => {
    // 1. Cachamos el paquete que mandó el Ewon
    const nuevoDato = req.body; // Aquí viene {"data1": "valor1", "data2": 100}
    
    // Le agregamos una marquita de tiempo, pa' saber a qué hora llegó el registro
    nuevoDato.fecha = new Date().toISOString();

    console.log("Llegó cargamento del Ewon:", nuevoDato);

    // 2. LEER el archivo actual para no borrar lo que ya tenías guardado
    fs.readFile(path.join(__dirname, 'datos-publicos.json'), 'utf8', (err, data) => {
        let listaDatos = [];

        // Si el archivo ya existe y tiene datos, los cargamos a la lista
        if (!err && data) {
            try {
                listaDatos = JSON.parse(data);
            } catch (e) {
                console.log("El archivo estaba medio chueco, empezamos limpio.");
            }
        }

        // 3. AGREGAR el nuevo JSON a la lista de registros
        listaDatos.push(nuevoDato);

        // 4. ESCRIBIR todo de regreso al archivo .json
        // El 'null, 2' es pa' que se acomode bonito con sangrías y lo puedas leer a gusto
        fs.writeFile(path.join(__dirname, 'datos-publicos.json'), JSON.stringify(listaDatos, null, 2), (err) => {
            if (err) {
                console.error("Se nos cayó el sistema al escribir el archivo:", err);
                return res.status(500).json({ status: "error", message: "Valió barriga el archivo" });
            }

            // 5. RESPUESTA AL EWON (Para que se le baje el botón a la HMI)
            console.log("¡Dato guardado en el archivo JSON, fierro!");
            res.status(200).json({ status: "success", message: "¡Adentro, pariente!" });
        });
    });
});

ex.post('/oauth/token', (req, res) => {
  const request = new OAuth2Server.Request(req);
  const response = new OAuth2Server.Response(res);

  ex.oauth.token(request, response)
    .then(token => {
        res.set(response.headers);
        res.json(response.body); 
    })
    .catch(err => {
        res.status(err.code || 500).json(err instanceof Error ? { error: err.message } : err);
    });
});


ex.listen(3030, '192.168.250.129', () => { 
    console.log('Servidor corriendo');});
