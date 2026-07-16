import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/require-auth.js"; import { requireStaff } from "../middleware/require-staff.js"; import { validate } from "../middleware/validate.js";
import { ValidationError } from "../../lib/errors.js";
import { parseImport, setMapping, preview, applyImport, IMPORT_FIELDS } from "../../services/import/import-service.js";
import { StaffActionRecord } from "../../models/staff-action.js";
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024}}); export const staffImportsRouter=Router(); staffImportsRouter.use("/staff/imports",requireAuth,requireStaff);
const uploadSchema = z.object({
  originalname: z.string().trim().min(1).max(255).refine((name) => name.toLowerCase().endsWith(".xlsx"), "An .xlsx workbook is required."),
  mimetype: z.string().trim().min(1).max(160),
  buffer: z.instanceof(Buffer).refine((buffer) => buffer.length > 0, "The uploaded workbook is empty."),
}).superRefine((file, ctx) => {
  const accepted = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"];
  if (!accepted.includes(file.mimetype)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["mimetype"], message: "An .xlsx workbook is required." });
});
const importIdSchema = z.object({ id: z.string().trim().regex(/^[a-f\d]{24}$/i, "Invalid import ID.") });
staffImportsRouter.post("/staff/imports",upload.single("file"),(req,res,next)=>{ try { const file=uploadSchema.parse(req.file); parseImport(file.buffer,file.originalname,req.account!).then(r=>res.status(201).json(r)).catch(next); } catch (error) { const message = error instanceof z.ZodError ? error.issues.map((issue) => `${issue.path.join(".") || "file"}: ${issue.message}`).join("; ") : "Invalid upload"; next(new ValidationError(message)); } });
const mappingSchema=z.object({mapping:z.record(z.enum(IMPORT_FIELDS))});
staffImportsRouter.put("/staff/imports/:id/mapping",validate({params:importIdSchema,body:mappingSchema}),(req,res,next)=>setMapping(req.params.id!,req.body.mapping).then(()=>res.status(200).json({ok:true})).catch(next));
staffImportsRouter.post("/staff/imports/:id/preview",validate({params:importIdSchema}),(req,res,next)=>preview(req.params.id!).then(r=>res.status(200).json(r)).catch(next));
staffImportsRouter.post("/staff/imports/:id/apply",validate({params:importIdSchema}),(req,res,next)=>applyImport(req.params.id!).then(async r=>{await StaffActionRecord.create({staffId:req.account!._id,staffName:req.account!.displayName,action:"import_apply",targetType:"import",targetId:new Types.ObjectId(req.params.id!),details:{rows:r.outcomes.length}});res.status(200).json(r);}).catch(next));
