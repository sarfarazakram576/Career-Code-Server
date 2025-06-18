require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Job portal is running");
});

const admin = require("firebase-admin");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')

const serviceAccount = JSON.parse(decoded)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req?.headers?.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;

    next();
  } catch (error) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

const verifyTokenEmail = (req, res, next) => {
  if (req.query.email !== req.decoded.email) {
    return res.status(403).send({ message: "Forbidden Access" });
  }
  next();
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.or0q8ig.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const jobsCollection = client.db("Career-Code").collection("Jobs");
    const applicationsCollection = client
      .db("Career-Code")
      .collection("applications");

    app.get("/jobs", async (req, res) => {
      const email = req.query.email;
      let query = {};

      if (email) {
        query.hr_email = email;
      }
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/jobs", async (req, res) => {
      const email = req.query.email;
      const query = { hr_email: email };
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    app.get(
      "/jobs/applications",
      verifyFirebaseToken,
      verifyTokenEmail,
      async (req, res) => {
        const { email } = req.query;

        const query = { hr_email: email };
        const jobs = await jobsCollection.find(query).toArray();

        for (const job of jobs) {
          const applicationQuery = { jobId: job._id.toString() };
          const application_count = await applicationsCollection.countDocuments(
            applicationQuery
          );
          job.applicationCount = application_count;
        }

        res.send(jobs);
      }
    );

    app.get("/jobs/:id", async (req, res) => {
      const result = await jobsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    app.post("/jobs", async (req, res) => {
      const job = req.body;
      const result = await jobsCollection.insertOne(job);
      res.send(result);
    });

    app.get("/applications/:id", async (req, res) => {
      const result = await applicationsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    app.get("/applications", verifyFirebaseToken, verifyTokenEmail, async (req, res) => {
      const email = req.query.email;

      const query = { applicant: email };
      const result = await applicationsCollection.find(query).toArray();

      // bad way to aggregate data
      for (const application of result) {
        const jobId = application.jobId;
        const query = { _id: new ObjectId(jobId) };
        const job = await jobsCollection.findOne(query);
        application.company = job.company;
        application.title = job.title;
        application.company_logo = job.company_logo;
        application.location = job.location;
      }
      res.send(result);
    });

    app.get("/applications/job/:job_id", async (req, res) => {
      const { job_id } = req.params;
      const query = { jobId: job_id };
      const result = await applicationsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/applications", async (req, res) => {
      const application = req.body;
      const result = await applicationsCollection.insertOne(application);
      res.send(result);
    });

    app.patch("/applications/:id", async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: req.body.status,
        },
      };
      const result = await applicationsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Job portal running on port ${port}`);
});
