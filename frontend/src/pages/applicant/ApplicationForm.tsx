import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApplicationPayload } from "../../api/applications";
import { getApplication, createApplication, updateApplication } from "../../api/applications";
import { CATEGORY_LABELS } from "../../lib/constants";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.enum(["BUDGET_REQUEST", "LEAVE_REQUEST", "EQUIPMENT_REQUEST", "OTHER"]),
  description: z.string().min(1, "Description is required"),
  amount: z.number().positive("Must be positive").optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ApplicationForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing } = useQuery({
    queryKey: ["application", id],
    queryFn: () => getApplication(id!),
    enabled: isEditing,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (existing) {
      reset({
        title: existing.title,
        category: existing.category,
        description: existing.description,
        amount: existing.amount ? Number(existing.amount) : undefined,
      });
    }
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (data: ApplicationPayload) =>
      isEditing ? updateApplication(id!, data) : createApplication(data),
    onSuccess: (app) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["application", app.id] });
      navigate(`/applications/${app.id}`);
    },
  });

  async function onSubmit(values: FormValues) {
    await mutation.mutateAsync(values as ApplicationPayload);
  }

  return (
    <div className="max-w-xl">
      <h1 className="page-title">{isEditing ? "Edit Application" : "New Application"}</h1>

      {mutation.isError && (
        <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Something went wrong."}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 card p-4 sm:p-6">
        <div>
          <label className="label">Title</label>
          <input {...register("title")} className="input-field" />
          {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label className="label">Category</label>
          <select {...register("category")} className="input-field">
            <option value="">Select…</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {errors.category && <p className="text-xs text-destructive mt-1">{errors.category.message}</p>}
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            {...register("description")}
            rows={4}
            className="input-field resize-none"
          />
          {errors.description && <p className="text-xs text-destructive mt-1">{errors.description.message}</p>}
        </div>

        <div>
          <label className="label">
            Amount <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">$</span>
            <input
              type="number"
              step="0.01"
              {...register("amount", { setValueAs: (v) => v === "" ? undefined : Number(v) })}
              className="input-field pl-7"
            />
          </div>
          {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? "Saving…" : "Save Draft"}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
