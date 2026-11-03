export type BlogSection = { heading:string; paragraphs:string[]; points:string[] };
export type BlogPost = {
  slug:string; title:string; description:string; category:string; readTime:number;
  publishedAt:string; updatedAt:string; cover:string; coverAlt:string; intro:string;
  sections:BlogSection[]; related:string[];
};
export const blogPosts: BlogPost[];
export const blogPostBySlug: Record<string, BlogPost>;
