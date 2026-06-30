import express from "express";

// Create express applicaiton
const app = express();

// The port is door the our server listens on 
const port = 5000;

// A simple test route: when someone visits "/", the server sends back the message
app.get("/", (req, res) => {
    res.send("Chat server is running")
})

// this start listeting to the port and lods message
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
})
