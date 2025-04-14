import User from "../models/user.model.js";
import Message from "../models/message.model.js"
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar=async (req,res)=>{
    try {
        const loggedInUserId=req.user._id;
        const filteredUsers= await User.find({_id:{$ne:loggedInUserId}}).select("-password");
        res.status(200).json(filteredUsers)
    } catch (error) {
        console.log("Error in getting users for sidebar",error);
        res.status(500).json({error:"Internal Server error"});
    }
};

export const getMessages=async (req,res)=>{
    try {
        const{id:userToChatId}=req.params;
        const myId=req.user._id;
        const messages=await Message.find({
            $or:[
                {senderID:myId,receiverID:userToChatId},
                {senderID:userToChatId,receiverID:myId}
            ]
        }).sort({ createdAt: 1 });
        res.status(200).json(messages);
    } catch (error) {
        console.log("Error in messages controller:",error.message);
        res.status(500).json({error:"Internal Server Error"});
    }
}

export const sendMessage=async (req,res)=>{
    try {
        const {text,image}=req.body;
        const {id:receiverID}=req.params;
        const senderID=req.user._id;

        if(!receiverID) {
            return res.status(400).json({ error: "Receiver ID is required" });
        }

        let imageURL;
        if(image){
            try {
                const uploadResponse=await cloudinary.uploader.upload(image);
                imageURL=uploadResponse.secure_url;
            } catch (uploadError) {
                console.log("Error uploading image to cloudinary:", uploadError);
                return res.status(500).json({ error: "Failed to upload image" });
            }
        }

        const newMessage=new Message({
            senderID,
            receiverID,
            text,
            image:imageURL
        });

        await newMessage.save();

        // Send socket event if receiver is online
        const receiverSocketId=getReceiverSocketId(receiverID);
        if(receiverSocketId && io) {
            io.to(receiverSocketId).emit("newMessage",newMessage);
        }

        res.status(201).json(newMessage);
    } catch (error) {
        console.log("Error in sendMessage Controller",error.message);
        res.status(500).json({error:"Internal Server error"});
    }
};