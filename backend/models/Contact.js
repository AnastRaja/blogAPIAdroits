// models/Contact.js
import mongoose from "mongoose";

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 2,
  },
  email: {
    type: String,
    required: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
  },
  phone: {
    type: String,
    required: true,
    minlength: 10,
    match: [/^\+?[1-9]\d{1,14}$/, "Please enter a valid phone number"],
  },
  country: {
    type: String,
    required: true,
    minlength: 2,
  },
  contactMethod: {
    type: String,
    required: true,
    minlength: 2,
  },
  requirement: {
    type: String,
    required: true,
    minlength: 10,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Contact", contactSchema);
