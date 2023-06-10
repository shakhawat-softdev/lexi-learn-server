const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;
//middleware
app.use(express.json());
app.use(cors());
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)



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

const verifyJWT = (req, res, next) => {
   const authorization = req.headers.authorization;
   if (!authorization) {
      return res.status(401).send({ error: true, message: 'unaurhorize access' })
   };

   //bearer token
   const token = authorization.split(' ')[1];
   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
      if (error) {
         return res.status(401).send({ error: true, message: 'unaurhorize access' })
      }

      req.decoded = decoded;
      next();
   })
};

async function run() {
   try {
      // Connect the client to the server	(optional starting in v4.7)
      await client.connect();
      const classCollection = client.db("lexiLearnDB").collection("classes");
      const usersCollection = client.db("lexiLearnDB").collection("users");
      const selectedClassCollection = client.db("lexiLearnDB").collection("selected");
      const enrolledClassCollection = client.db("lexiLearnDB").collection("enrolled");
      const paymentHistoryCollection = client.db("lexiLearnDB").collection("payments");

      //Jwt
      app.post('/jwt', (req, res) => {
         const user = req.body;
         // console.log("userEmail", user)

         const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
         res.send({ token });
      });

      /*--------------------------------------------------- 
                      verify admin route
      -----------------------------------------------------*/
      app.get('/users/admin/:email', verifyJWT, async (req, res) => {
         const email = req.params.email;
         console.log("email", email)

         if (req.decoded.email !== email) {
            res.send({ admin: false })
         }
         const query = { userEmail: email }

         const user = await usersCollection.findOne(query);
         console.log("users", user)
         const result = { admin: user?.role === 'admin' }
         res.send(result);
      });




      /* FOR HOME PAGE    Popular Classes Section API */
      /*---------------------------------
            (Top-Six Class)
            Have the top 6 classes based on the number of students.
      ----------------------------------- */
      app.get('/classes', async (req, res) => {
         const result = await classCollection.find().sort({ enrolled: -1 }).limit(6).toArray()
         res.send(result)
      });

      /* HOME PAGE Popular INSTRUCTOR Section API  */
      /*---------------------------------
            (Top-Six Instructoe)
            Have the top 6 classes based on the number of students.
      ----------------------------------- */
      app.get('/instructors', async (req, res) => {
         const result = await classCollection.find().sort({ enrolled: -1 }).limit(6).toArray()
         res.send(result)
      });


      /* FOR CLASSES PAGE */
      /*------------------------------------------
         Get all APPROVED Classes for Classes Page
      -------------------------------------------*/
      app.get('/classes/:text', async (req, res) => {
         const text = req.params.text;
         if (text == 'approved') {
            const result = await classCollection.find({ status: text }).toArray()
            res.send(result)
         }
         else {
            res.send([]);
         };

      })




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

      //Get all Instructors for Instructor Page
      app.get('/users/:text', async (req, res) => {
         const text = req.params.text;
         // console.log(text)
         if (text == 'instructor') {
            const result = await usersCollection.find({ role: text }).toArray()
            res.send(result)
         }


      })

      //Selected is Inserted to to Student class list
      //TODO: jwt varification is needed
      app.post('/selectedClass', async (req, res) => {
         const userClass = req.body;
         // console.log(userClass);
         const result = await selectedClassCollection.insertOne(userClass)
         res.send(result)
      });

      //get all the selected from collection
      //TODO: jwt varification is needed
      app.get('/selectedClass', async (req, res) => {
         const result = await selectedClassCollection.find().toArray();
         res.send(result)
      });

      app.get('/selectedClass', async (req, res) => {
         const email = req.query.email;
         // console.log(email);
         if (!email) {
            res.send([]);
         };

         const query = { studentEmail: email };
         const result = await selectedClassCollection.find(query).toArray();
         res.send(result);
      });

      //DELETE Specifuc Clsses/Couse from Classescollection
      //TODO: jwt varification is needed
      app.delete('/selectedClass/:id', async (req, res) => {
         const classID = req.params.id;
         // console.log(classID);
         const query = { _id: new ObjectId(classID) }
         const result = await selectedClassCollection.deleteOne(query)
         res.send(result)
      })


      //Create Payment-Intent
      app.post("/create-payment-intent", async (req, res) => {
         const { total } = req.body;
         // console.log(total);
         const amount = parseInt(total * 100);
         const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: "usd",
            "payment_method_types": ["card"],
         });

         res.send({ clientSecret: paymentIntent.client_secret })
      });

      /* 
         //TODO Have to fix pamyent issue
      */
      //TODO Have to fix pamyent issue
      //When Payment is successfull, Remove all Selectrd Classess and shift selected class to enrolled classes
      app.post('/payments', async (req, res) => {
         const { enrolledClasses, paymentHistory } = req.body;

         const paymentHistoryInsetResult = await paymentHistoryCollection.insertOne(paymentHistory);
         const enrolledClssesResult = await enrolledClassCollection.insertMany(enrolledClasses);
         //TODO: Selected classes shouldbe delete from selected clssses
         const query = { _id: { $in: enrolledClasses.map(item => new ObjectId(item._id)) } };
         const deleteSelectedClassesResult = await selectedClassCollection.deleteMany(query);
         res.send(paymentHistoryInsetResult, enrolledClssesResult, deleteSelectedClassesResult);

      });

      //Get payment History
      app.get('/paymentHistory', async (req, res) => {
         const result = await paymentHistoryCollection.find().toArray()
         res.send(result)
      })




      //Get all Enrolld Class from Enroll class cOllection
      app.get('/enrolled', async (req, res) => {
         const email = req.query.email;
         // console.log(email);
         if (!email) {
            res.send([]);
         }
         const query = { studentEmail: email };
         const result = await enrolledClassCollection.find(query).toArray();
         res.send(result);

      });


      //Instructor API
      //ADD new Class
      app.post('/classes', async (req, res) => {
         const classData = req.body;
         console.log(classData)
         const result = await classCollection.insertOne(classData);
         res.send(result);
      });

      //TODO: Jodi time thake tahole eta dekte hobe otherwise dorkar nai
      // app.get('/myClasses', async (req, res) => {
      //    const email = req.query.email;
      //    // console.log(email);
      //    if (!email) {
      //       res.send([]);
      //    };
      //    const query = { instructorEmail: email };
      //    const result = await classCollection.find(query).toArray();
      //    res.send(result);
      // });


      // get Instructor Own Classes
      app.get('/myClasses', async (req, res) => {
         // console.log(req.query.email);
         let query = {};
         if (req.query?.email) {
            query = { instructorEmail: req.query.email }
         }
         const result = await classCollection.find(query).toArray()
         res.send(result)
      });

      /* --------------------------------------------------
       //                  ADMIN PART
      ----------------------------------------------------*/
      // GET ALL THE CLASSES FROM COLLECTION

      // app.get('/classes', async (req, res) => {
      //    const result = await classCollection.find().toArray();
      //    res.send(result)
      // });



      //SET STATUS- AS [APPROVE OR DENEIED] TAG TO CLASS FROM COLLECTION
      app.patch('/classes/:id', async (req, res) => {
         const id = req.params.id;
         const filter = { _id: new ObjectId(id) }
         const updatedBooking = req.body;

         // console.log(updatedBooking);
         const updateDoc = {
            $set: {
               status: updatedBooking.status
            },
         };
         const result = await classCollection.updateOne(filter, updateDoc);
         res.send(result)
      });

      // GET ALL THE USERS FROM  USERS COLLECTION
      app.get('/users', async (req, res) => {
         const result = await usersCollection.find().toArray();
         res.send(result)
      });

      //SET USER ROLE AS-[ADMIN OR INSTRUCTOR] TAG TO USER TO COLLECTION
      app.patch('/users/:id', async (req, res) => {
         const id = req.params.id;
         console.log(id)
         const filter = { _id: new ObjectId(id) }
         const updatedBooking = req.body;

         console.log(updatedBooking);

         const updateDoc = {
            $set: {
               role: updatedBooking.role
            },
         };
         const result = await usersCollection.updateOne(filter, updateDoc);
         res.send(result)
      });


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