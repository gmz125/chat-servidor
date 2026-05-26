import { WebSocketServer } from 'ws'
// Importamos la conexión pool de MySQL que configuramos antes
import pool from './db.js'

class wsServer {
    constructor() {
        // Configuramos Railway para que use el puerto que le asigne la plataforma o el 8080 local
        const port = process.env.PORT || 8080
        this.wss = new WebSocketServer({ port })
        this.clientsByName = {}
        this.pendingMessages = {}
        
        console.log(`Servidor WebSocket iniciado en el puerto: ${port}`)

        // Intentamos inicializar las tablas de la base de datos MySQL
        this.inicializarTablasMySQL()

        // Un cliente se conecta
        this.wss.on('connection', (ws) => {
            this.MSG(ws, "IDENTIFICATE") // Solicito identificación

            ws.on('message', (datos) => {
                datos = this.jsonAJS(datos) // Conversión segura
                if(datos) {
                    const {mensaje, data} = datos

                    // Ejecuto dinámicamente al método gestor del mensaje
                    if(this[mensaje] && typeof this[mensaje] == "function")
                        this[mensaje](ws, data) 
                }
            })

            // Un cliente se desconecta
            ws.on('close', () => {
                if (ws.data) {
                    console.log(`${ws.data} desconectado`)
                    delete this.clientsByName[ws.data]
                }
                this.CONECTADOS(ws)
            })

            // Siempre que se conecte un nuevo cliente, informo a los otros
            this.CONECTADOS(ws)
        })
    }

    /**
     * 🗄️ NUEVO MÉTODO: Crea las tablas automáticamente en MySQL si no existen
     */
    async inicializarTablasMySQL() {
        try {
            console.log("Creando tablas en MySQL si no existen...")
            // Creamos la tabla de mensajes permanentes
            await pool.query(`
                CREATE TABLE IF NOT EXISTS mensajes (
                    id VARCHAR(255) PRIMARY KEY,
                    emisor VARCHAR(255) NOT NULL,
                    receptor VARCHAR(255) NOT NULL,
                    mensaje TEXT NOT NULL,
                    grupo VARCHAR(255) NULL,
                    timestamp BIGINT NOT NULL,
                    visto TINYINT(1) DEFAULT 0
                )
            `);
            console.log("✅ Tablas de MySQL verificadas y listas.");
        } catch (error) {
            console.error("❌ Error al inicializar tablas en MySQL:", error.message);
        }
    }

    //
    // Gestores de mensajes
    //

    IDENTIFICACION(ws, data) {
        ws.data = data
        this.clientsByName[data] = ws
        console.log(`${ws.data} conectado...`)
        this.deliverPendingMessages(data)
    }

    CONECTADOS(ws, data) {
        data = []
        for (const cliente of this.wss.clients)
            if(ws.data != cliente.data && cliente.data != undefined)
                data.push(cliente.data)

        if(data.length)
            this.MSG(ws, "CONECTADOS", data)
    }

    // Modificamos CHAT para que sea asíncrono (async) y guarde en MySQL
    async CHAT(ws, data) {
        if(data) {
            const emisor = ws.data,
            {receptor, mensaje, id, grupo} = data 

            // 💾 MODIFICACIÓN: Guardamos el mensaje de forma permanente en MySQL
            try {
                const timestampActual = Date.now();
                // Como 'receptor' es un array en tu frontend, guardamos el primer destinatario o un texto descriptivo
                const destinatarioPrincipal = Array.isArray(receptor) ? receptor[0] : receptor;

                await pool.query(
                    'INSERT INTO mensajes (id, emisor, receptor, mensaje, grupo, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
                    [id || `m-${timestampActual}-${emisor}`, emisor, destinatarioPrincipal, mensaje, grupo || null, timestampActual]
                );
                console.log(`💾 Mensaje de [${emisor}] guardado en MySQL con éxito.`);
            } catch (err) {
                console.error("❌ Error al guardar el mensaje en MySQL:", err.message);
            }

            // Continuamos reenviando el mensaje a los usuarios en tiempo real
            for (const destinatario of receptor) {
                const payload = { emisor, mensaje, id }
                if (grupo) payload.grupo = grupo
                this.notifyRecipient(destinatario, "CHAT", payload)
            }
        }
    }

    GRUPO_CREAR(ws, data) {
        if (!data || !data.id || !Array.isArray(data.integrantes)) return
        for (const destinatario of data.integrantes) {
            if (destinatario === ws.data) continue
            this.notifyRecipient(destinatario, "GRUPO_CREAR", { id: data.id, integrantes: data.integrantes })
        }
    }

    GRUPO_ACTUALIZAR(ws, data) {
        if (!data || !data.id || !Array.isArray(data.integrantes)) return
        for (const destinatario of data.integrantes) {
            if (destinatario === ws.data) continue
            this.notifyRecipient(destinatario, "GRUPO_ACTUALIZAR", { id: data.id, integrantes: data.integrantes })
        }
    }

    notifyRecipient(destinatario, mensaje, payload) {
        const socket = this.socketId(destinatario)
        if (socket) {
            this.MSG(socket, mensaje, payload)
        } else {
            this.queueMessage(destinatario, mensaje, payload)
        }
    }

    queueMessage(destinatario, mensaje, payload) {
        if (!this.pendingMessages[destinatario]) this.pendingMessages[destinatario] = []
        this.pendingMessages[destinatario].push({ mensaje, data: payload })
        console.log(`Mensaje en cola para ${destinatario}:`, { mensaje, payload })
    }

    deliverPendingMessages(usuario) {
        const socket = this.clientsByName[usuario]
        const cola = this.pendingMessages[usuario]
        if (!socket || !cola || !cola.length) return

        cola.forEach((pending) => {
            this.MSG(socket, pending.mensaje, pending.data)
        })
        delete this.pendingMessages[usuario]
        console.log(`Entregados ${cola.length} mensajes pendientes a ${usuario}`)
    }

    socketId(id) {
        for (const cliente of this.wss.clients)
            if(cliente.data == id) return cliente
        return false
    }

    MSG(ws, mensaje, data) {
        const msg = data != {} && data != undefined && data != null ?
            this.JSAJson({mensaje, data}) : this.JSAJson({mensaje})
        
        if(msg && ws.readyState === 1) { 
            ws.send(msg)
        }
    }

    jsonAJS(json) {
        try { return JSON.parse(json) }
        catch { return false }
    }

    JSAJson(js) {
        try { return JSON.stringify(js) }
        catch { return false }
    }
}

new wsServer()