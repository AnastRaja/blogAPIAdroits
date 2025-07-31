import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer";
import {v2 as cloudinary} from "cloudinary";
import dotenv from "dotenv";
import Image from "./models/Image.js";
import Blog from "./models/Blog.js";
import Category from "./models/Category.js";
import path from "path";
import {fileURLToPath} from "url";
import {PassThrough} from "stream";
import Contact from "./models/Contact.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({path: path.join(__dirname, ".env")});

const app = express();

app.use(cors());
app.use(express.json());

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Log Cloudinary config for debugging
console.log("Cloudinary Config:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET ? "Set" : "Not Set",
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Route setup
app.get("/", (req, res) => {
  res.send("server is ready");
});

// Configure Multer with memory storage
const storage = multer.memoryStorage();
const upload = multer({storage});

// Upload image to Cloudinary and save URL in DB
app.post("/api/images", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({message: "No image file uploaded"});
    }

    console.log("File received:", {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });

    const {title, description, category} = req.body;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "blog_uploads",
        public_id: `${Date.now()}-${req.file.originalname}`,
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return res
            .status(500)
            .json({message: "Cloudinary upload failed", error: error.message});
        }

        const imagePath = result.secure_url;

        const newImage = new Image({
          title,
          description,
          category,
          imagePath,
        });

        newImage
          .save()
          .then(() => {
            console.log("Image saved to DB:", imagePath);
            res.status(201).json(newImage);
          })
          .catch((saveError) => {
            console.error("Error saving to DB:", saveError);
            res
              .status(500)
              .json({message: "Database save error", error: saveError.message});
          });
      }
    );

    const bufferStream = new PassThrough();
    bufferStream.end(req.file.buffer);
    bufferStream.pipe(uploadStream);
  } catch (error) {
    console.error("Error in POST /api/images:", error);
    res
      .status(500)
      .json({message: "Internal server error", error: error.message});
  }
});

// Get all images
app.get("/api/images", async (req, res) => {
  try {
    const images = await Image.find();
    res.status(200).json(images);
  } catch (error) {
    console.error("Error in GET /api/images:", error);
    res
      .status(500)
      .json({message: "Internal server error", error: error.message});
  }
});

// Get single image by ID
app.get("/api/images/:id", async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) {
      return res.status(404).json({message: "Image not found"});
    }
    res.status(200).json(image);
  } catch (error) {
    console.error("Error in GET /api/images/:id:", error);
    res
      .status(500)
      .json({message: "Internal server error", error: error.message});
  }
});

// Create a new category
app.post("/api/categories", async (req, res) => {
  try {
    const {name, description} = req.body;

    if (!name) {
      return res.status(400).json({message: "Category name is required"});
    }

    const existingCategory = await Category.findOne({name});
    if (existingCategory) {
      return res.status(400).json({message: "Category already exists"});
    }

    const newCategory = new Category({
      name,
      description,
    });

    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    res
      .status(500)
      .json({message: "Internal server error", error: error.message});
  }
});

// Get all categories
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (error) {
    res
      .status(500)
      .json({message: "Internal server error", error: error.message});
  }
});

// Helper function to upload image to Cloudinary
const uploadImage = (file) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "blog_images", // Store images in a 'blog_images' folder
        public_id: `${Date.now()}-${file.originalname}`, // Unique public ID
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );

    const bufferStream = new PassThrough();
    bufferStream.end(file.buffer);
    bufferStream.pipe(uploadStream);
  });
};

// Blog creation route

app.post("/api/blogs", upload.single("image"), async (req, res) => {
  try {
    const {title, description, body, category} = req.body;

    // Validate required fields
    if (!title || !description || !body || !category) {
      return res.status(400).json({message: "All fields are required"});
    }

    if (!req.file) {
      return res.status(400).json({message: "Image is required"});
    }

    // Check if category exists
    const categoryExists = await Category.findOne({name: category});
    if (!categoryExists) {
      return res.status(400).json({message: "Category does not exist"});
    }

    // Upload image to Cloudinary
    const imageUrl = await uploadImage(req.file);

    // Generate initial slug
    let slug = title
      .toString()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");

    // Check for existing slugs and add suffix if needed
    let slugExists = true;
    let suffix = 1;
    let finalSlug = slug;

    while (slugExists) {
      const existingBlog = await Blog.findOne({slug: finalSlug});
      if (!existingBlog) {
        slugExists = false;
      } else {
        finalSlug = `${slug}-${suffix}`;
        suffix++;
      }
    }

    // Create new blog post
    const newBlog = new Blog({
      title,
      slug: finalSlug,
      description,
      body,
      category,
      imageUrl,
    });

    await newBlog.save();
    res.status(201).json(newBlog);
  } catch (error) {
    console.error("Error creating blog:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});
// Get all blogs (list view - minimal data)
app.get("/api/blogs", async (req, res) => {
  try {
    const blogs = await Blog.find(
      {},
      "title description category imageUrl slug body createdAt"
    ).sort({createdAt: -1}); // Newest first
    res.status(200).json(blogs);
  } catch (error) {
    console.error("Error in GET /api/blogs:", error);
    res
      .status(500)
      .json({message: "Internal server error", error: error.message});
  }
});

// Get single blog by slug (detail view)
app.get("/api/blogs/:slug", async (req, res) => {
  try {
    const blog = await Blog.findOne({slug: req.params.slug});
    if (!blog) {
      return res.status(404).json({message: "Blog not found"});
    }
    res.status(200).json(blog);
    console.log("blog found", blog);
  } catch (error) {
    console.error("Error in GET /api/blogs/:slug:", error);
    res
      .status(500)
      .json({message: "Internal server error", error: error.message});
  }
});
// API Route for Contact Form
app.post("/api/contact", async (req, res) => {
  try {
    console.log("Request body:", req.body); // Debug: Log incoming data
    const {name, email, phone, country, contactMethod, requirement} = req.body;

    // Manual validation for missing fields
    if (
      !name ||
      !email ||
      !phone ||
      !country ||
      !contactMethod ||
      !requirement
    ) {
      return res.status(400).json({error: "All fields are required"});
    }

    const contact = new Contact({
      name,
      email,
      phone,
      country,
      contactMethod,
      requirement,
    });

    await contact.save();
    res
      .status(201)
      .json({message: "Contact form submitted successfully", contact});
  } catch (error) {
    console.error("Error saving contact:", error); // Detailed error log
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({error: "Validation failed", details: errors});
    }
    res
      .status(500)
      .json({error: "Failed to submit contact form", details: error.message});
  }
});
app.get("/api/contact", async (req, res) => {
  try {
    const contacts = await Contact.find().sort({createdAt: -1});
    res.status(200).json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res
      .status(500)
      .json({error: "Failed to fetch contact details", details: error.message});
  }
});
app.get("/api/blogurls", async (req, res) => {
  try {
    const slugs = await Blog.find({}, "slug -_id");
    res.status(200).json(slugs);
  } catch (error) {
    console.error("Error in GET /api/blogs/slugs:", error);
    res
      .status(500)
      .json({message: "Internal server error", error: error.message});
  }
});
// Server host setup
app.listen(5000, () => {
  console.log("App started in local host 5000 hello");
});
