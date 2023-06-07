const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;
//middleware
app.use(express.json());
app.use(cors());



app.get('/', (req, res) => {
   res.send("Lexi Learn is running.....")
})


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7lxiyyz.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
   serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
   }
});

async function run() {
   try {
      // Connect the client to the server	(optional starting in v4.7)
      await client.connect();
      const classCollection = client.db("lexiLearnDB").collection("classes");
      const usersCollection = client.db("lexiLearnDB").collection("users");


      //Get all the classes. TODO: apply filter for popular Classes
      app.get('/classes', async (req, res) => {
         const result = await classCollection.find().toArray();
         res.send(result)
      });

      //Inset User In UserCollections
      app.post('/users', async (req, res) => {
         const userData = req.body;
         // console.log(userData);
         const query = { userEmail: userData.userEmail }
         const ifExistUser = await usersCollection.findOne(query);
         if (ifExistUser) {
            return res.send({ message: 'User Already Exist!' })
         };

         const result = await usersCollection.insertOne(userData)
         res.send(result)
      });

      //Get all Instructor
      app.get('/users/:text', async (req, res) => {
         const text = req.params.text;
         console.log(text)
         if (text == 'instructor') {
            const result = await usersCollection.find({ role: text }).toArray()
            res.send(result)
         }

      })






      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
   } finally {
      // Ensures that the client will close when you finish/error
      // await client.close();
   }
}
run().catch(console.dir);






app.listen(port, () => {
   console.log(`Lexi Learn is running on ${port}`)
})