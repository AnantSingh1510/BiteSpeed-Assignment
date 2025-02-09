import express from 'express'
const app = express();
const port = 3000;

app.get('/', (req, res) => {
    res.status(200).json({ message: 'Hello, this TS application is working' })
})

app.listen(port, () => {
    return console.log(`Express is listening at http://localhost:${port}`);
  });