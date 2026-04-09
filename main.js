// index.js
const express = require('express');
const app = express();

app.use(express.static(__dirname));

const port = process.env.PORT || 3000;
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});