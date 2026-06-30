import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        username:{
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        email:{
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true, //stores emails in lowercase
    },
    password:{
        type: String,
        required: true,
    },
    profilePicture:{
        type: String,
        default: "",
    },
    status:{
        type: String,
        default: "offline",
    },
    isAdmin:{
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true, // auto adds createdat and updatedAt fields
}
)

const user = mongoose.model("User", userSchema);
export default user;