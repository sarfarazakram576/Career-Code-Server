require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/' , (req, res)=>{
    res.send('Job portal is running')
})

app.listen(port, ()=>{
    console.log(`Job portal running on port ${port}`)
})