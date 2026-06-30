import mongoose from "mongoose";

async function connectToDatabase(){
    try{
        const mongoUri = process.env.MONGO_URI;
        if(!mongoUri){
            console.log("Error: Mongo_URI is mssing from the .env file");
            return
        }

        await mongoose.connect(mongoUri);
        console.log("MongoDB connected successfully");
    } catch (error) {
        console.log("Failed to connec to MongoDB");
        console.error(error);

}
}

export default connectToDatabase;


