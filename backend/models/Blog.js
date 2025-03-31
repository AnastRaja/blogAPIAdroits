// models/Blog.js
import mongoose from "mongoose";

const blogSchema = new mongoose.Schema({
  title: {type: String, required: true},
  slug: {type: String, required: true, unique: true},
  description: {type: String, required: true},
  body: {type: String, required: true},
  category: {type: String, required: true},
  imageUrl: {type: String, required: true},
  createdAt: {type: Date, default: Date.now},
});

// Improved pre-save hook
blogSchema.pre("save", function (next) {
  if (!this.slug) {
    this.slug = generateSlug(this.title);
  }
  next();
});

// Helper function to generate slugs
function generateSlug(title) {
  return title
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

const Blog = mongoose.model("Blog", blogSchema);
export default Blog;
