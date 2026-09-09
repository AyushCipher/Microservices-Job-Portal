"use client";
import { useParams } from "next/navigation";
import Cookies from "js-cookie";
import React, { useEffect, useRef, useState } from "react";
import { job_service, useAppData } from "@/context/AppContext";
import { Application, Company, Job } from "@/type";
import axios from "axios";
import Loading from "@/components/loading";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Award,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Eye,
  FileText,
  GraduationCap,
  Laptop,
  MapPin,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Users2,
  Wallet,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { getErrorMessage } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import CompanyLogo from "@/components/company-logo";
import ChipInput from "@/components/chip-input";
import RoundsBuilder, { RoundInput } from "@/components/rounds-builder";



const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? <p className="text-xs text-red-500 mt-1">{message}</p> : null;

// Common questions recruiters ask on SDE-style roles — offered as one-click
// suggestions so the recruiter isn't retyping the same handful every time.
const SUGGESTED_APPLICATION_QUESTIONS = [
  "What is your current notice period?",
  "Share your LinkedIn profile URL",
  "Share your GitHub profile URL",
  "Share your LeetCode / competitive coding profile URL",
  "Any open source contributions you'd like to highlight?",
  "Briefly describe your most relevant work experience",
  "What are your salary / CTC expectations?",
];

const CompanyPage = () => {
  const { id } = useParams();
  const token = Cookies.get("token");
  const { user } = useAppData();
  const [loading, setLoading] = useState(false);
  const [btnLoading, setBtnLoading] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);

  async function fetchCompany() {
    try {
      setLoading(true);
      const { data } = await axios.get(`${job_service}/api/job/company/${id}`);
      setCompany(data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCompany();
  }, [id]);

  const isRecruiterOwner =
    user && company && user.user_id === company.recruiter_id;

  const [isUpdatedModalOpen, setIsUpdatedModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const addModalRef = useRef<HTMLButtonElement>(null);
  const updateModalRef = useRef<HTMLButtonElement>(null);

  // Core fields (existing)
  const [title, settitle] = useState("");
  const [description, setdescription] = useState("");
  const [role, setrole] = useState("");
  const [salary, setsalary] = useState("");
  const [location, setlocation] = useState("");
  const [openings, setopenings] = useState("");
  const [job_type, setjob_type] = useState("");
  const [work_location, setwork_location] = useState("");
  const [is_active, setis_active] = useState(true);

  // Job Detail redesign fields
  const [rounds, setRounds] = useState<RoundInput[]>([
    { name: "", description: "" },
  ]);


  const [tags, setTags] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [applyBy, setApplyBy] = useState("");
  const [roleType, setRoleType] = useState("");
  const [duration, setDuration] = useState("");
  const [qualification, setQualification] = useState("");
  const [workingDays, setWorkingDays] = useState("");
  const [minHires, setMinHires] = useState("");
  const [expectedOffers, setExpectedOffers] = useState("");
  const [ctcMin, setCtcMin] = useState("");
  const [ctcMax, setCtcMax] = useState("");
  const [stipend, setStipend] = useState("");
  const [category, setCategory] = useState("");
  const [conversionNote, setConversionNote] = useState("");
  const [eligibleGender, setEligibleGender] = useState("");
  const [eligibleGradYears, setEligibleGradYears] = useState("");
  const [criteria, setCriteria] = useState("");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<
    Job["attachments"]
  >([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearInput = () => {
    settitle("");
    setdescription("");
    setrole("");
    setsalary("");
    setlocation("");
    setopenings("");
    setjob_type("");
    setwork_location("");
    setis_active(true);
    setRounds([{ name: "", description: "" }]);
    setTags([]);
    setSkills([]);
    setQuestions([]);
    setApplyBy("");
    setRoleType("");
    setDuration("");
    setQualification("");
    setWorkingDays("");
    setMinHires("");
    setExpectedOffers("");
    setCtcMin("");
    setCtcMax("");
    setStipend("");
    setCategory("");
    setConversionNote("");
    setEligibleGender("");
    setEligibleGradYears("");
    setCriteria("");
    setJdFile(null);
    setExistingAttachments([]);
    setErrors({});
  };

  const validateForm = (isEdit: boolean): boolean => {
    const next: Record<string, string> = {};

    if (!title.trim()) next.title = "Title is required";
    if (!role.trim()) next.role = "Role/Department is required";
    if (!location.trim()) next.location = "Location is required";
    if (!description.trim()) next.description = "Description is required";
    if (!job_type) next.job_type = "Job type is required";
    if (!work_location) next.work_location = "Work mode is required";
    if (!salary || Number(salary) <= 0)
      next.salary = "Salary/CTC is required";
    if (!openings || Number(openings) <= 0)
      next.openings = "Requirement (headcount) is required";
    if (!roleType.trim()) next.roleType = "Role type is required";
    if (!duration.trim()) next.duration = "Duration is required";
    if (!qualification.trim())
      next.qualification = "Qualification is required";
    if (!workingDays.trim()) next.workingDays = "Working days is required";
    if (!applyBy) next.applyBy = "Apply-by deadline is required";
    if (skills.length === 0)
      next.skills = "Add at least one required skill";
    if (rounds.length === 0 || rounds.some((r) => !r.name.trim()))
      next.rounds = "Every hiring round needs a name";
    if (!isEdit && !jdFile)
      next.jdFile = "Job description PDF is required";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildJobPayload = () => ({
    title,
    description,
    role,
    salary: Number(salary),
    location,
    openings: Number(openings),
    job_type,
    work_location,
    rounds: rounds
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        description: r.description.trim() || undefined,
      })),
    tags,
    skills,
    questions,
    apply_by: new Date(applyBy).toISOString(),
    role_type: roleType,
    duration,
    qualification,
    working_days: workingDays,
    min_hires: minHires ? Number(minHires) : undefined,
    expected_offers: expectedOffers ? Number(expectedOffers) : undefined,
    ctc_min: ctcMin ? Number(ctcMin) : undefined,
    ctc_max: ctcMax ? Number(ctcMax) : undefined,
    stipend: stipend ? Number(stipend) : undefined,
    category: category.trim() || undefined,
    conversion_note: conversionNote.trim() || undefined,
    eligible_gender: eligibleGender.trim() || undefined,
    eligible_grad_years: eligibleGradYears.trim() || undefined,
    criteria: criteria.trim() || undefined,
  });

  const uploadAttachmentIfAny = async (jobId: number) => {
    if (!jdFile) return;
    const formData = new FormData();
    formData.append("file", jdFile);
    await axios.post(`${job_service}/api/job/${jobId}/attachments`,
      formData,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  };

  const addJobHandler = async () => {
    if (!validateForm(false)) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setBtnLoading(true);
    try {
      const { data } = await axios.post(`${job_service}/api/job/new`,
        { ...buildJobPayload(), company_id: id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await uploadAttachmentIfAny(data.job.job_id);

      toast.success("New job posted successfully");
      fetchCompany();
      clearInput();
      addModalRef.current?.click();
    } catch (error: any) {
      console.log(error);
      toast.error(error.response?.data?.message || "Failed to post job");
    } finally {
      setBtnLoading(false);
    }
  };


  const deleteHandler = async (jobId: number) => {
    if (confirm("Are you sure you want to delete this job?")) {
      setBtnLoading(true);
      try {
        await axios.delete(`${job_service}/api/job/${jobId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        toast.success("Job deleted successfully");
        fetchCompany();

      } catch (error: any) {
        toast.error(getErrorMessage(error));

      } finally {
        setBtnLoading(false);
      }
    }
  };

  // --- Manage Applicants: bulk stage-advance panel ---
  const [manageJob, setManageJob] = useState<Job | null>(null);
  const [manageApplications, setManageApplications] = useState<Application[]>(
    []
  );
  const [manageLoading, setManageLoading] = useState(false);
  const [selectedAppIds, setSelectedAppIds] = useState<number[]>([]);
  const [stageRoundId, setStageRoundId] = useState("");
  const [stageStatus, setStageStatus] = useState("");
  const [stageNote, setStageNote] = useState("");
  const [stageSubmitting, setStageSubmitting] = useState(false);

  const openManageApplicants = async (job: Job) => {
    setManageLoading(true);
    setSelectedAppIds([]);
    setStageRoundId("");
    setStageStatus("");
    setStageNote("");
    try {
      const [{ data: full }, { data: appsRes }] = await Promise.all([
        axios.get<Job>(`${job_service}/api/job/${job.job_id}`),
        axios.get(`${job_service}/api/job/application/${job.job_id}?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setManageJob(full);
      setManageApplications(appsRes.data);

    } catch (error) {
      toast.error("Failed to load applicants");

    } finally {
      setManageLoading(false);
    }
  };


  const toggleSelectedApp = (id: number) => {
    setSelectedAppIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };


  const submitStageUpdate = async () => {
    if (selectedAppIds.length === 0) {
      toast.error("Please select at least one applicant");
      return;
    }
    if (!stageRoundId || !stageStatus) {
      toast.error("Please choose a round and a status");
      return;
    }

    setStageSubmitting(true);
    try {
      await axios.put(`${job_service}/api/job/application/stage`,
        {
          applicationIds: selectedAppIds,
          round_id: Number(stageRoundId),
          status: stageStatus,
          note: stageNote || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Stage updated for the selected applicants");
      
      if (manageJob) await openManageApplicants(manageJob);
      
      setSelectedAppIds([]);
      setStageNote("");

    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update stage");
    
    } finally {
      setStageSubmitting(false);
    }
  };

  const [loadingJobDetail, setLoadingJobDetail] = useState(false);

  // Hydrating Form States for Job Updates
  const handleOpenUpdateModal = async (job: Job) => {
    setLoadingJobDetail(true);
    try {
      // company.jobs only has the bare `jobs` row (no rounds/tags/details) —
      // fetch the full detail so the edit form doesn't wipe an existing
      // pipeline down to a single blank round on save.
      const { data: full } = await axios.get<Job>(`${job_service}/api/job/${job.job_id}`);

      setSelectedJob(full);
      settitle(full.title);
      setdescription(full.description);
      setrole(full.role);
      setsalary(String(full.salary || ""));
      setlocation(full.location || "");
      setopenings(String(full.openings));
      setjob_type(full.job_type);
      setwork_location(full.work_location);
      setis_active(full.is_active);
      setRounds(
        full.rounds.length > 0
          ? full.rounds.map((r) => ({
              name: r.name,
              description: r.description || "",
            }))
          : [{ name: "", description: "" }]
      );
      setTags(full.tags || []);
      setSkills(full.skills || []);
      setQuestions((full.questions || []).map((q) => q.question_text));
      setApplyBy(full.apply_by ? full.apply_by.slice(0, 10) : "");
      setRoleType(full.role_type || "");
      setDuration(full.duration || "");
      setQualification(full.qualification || "");
      setWorkingDays(full.working_days || "");
      setMinHires(full.min_hires != null ? String(full.min_hires) : "");
      setExpectedOffers(
        full.expected_offers != null ? String(full.expected_offers) : ""
      );

      setCtcMin(full.ctc_min != null ? String(full.ctc_min) : "");
      setCtcMax(full.ctc_max != null ? String(full.ctc_max) : "");
      setStipend(full.stipend != null ? String(full.stipend) : "");
      setCategory(full.category || "");
      setConversionNote(full.conversion_note || "");
      setEligibleGender(full.eligible_gender || "");
      setEligibleGradYears(full.eligible_grad_years || "");
      setCriteria(full.criteria || "");
      setExistingAttachments(full.attachments || []);
      setJdFile(null);
      setErrors({});
      setIsUpdatedModalOpen(true);

    } catch {
      toast.error("Failed to load job details");

    } finally {
      setLoadingJobDetail(false);
    }
  };

  const handleCloseUpdateModal = () => {
    setIsUpdatedModalOpen(false);
    setSelectedJob(null);
    clearInput();
  };

  const updateJobHandler = async () => {
    if (!selectedJob) return;
    if (!validateForm(true)) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setBtnLoading(true);
    try {
      const updateData = { ...buildJobPayload(), is_active };

      await axios.put(`${job_service}/api/job/${selectedJob.job_id}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      await uploadAttachmentIfAny(selectedJob.job_id);

      toast.success("Job updated successfully");
      fetchCompany();
      handleCloseUpdateModal();

    } catch (error: any) {
      toast.error(getErrorMessage(error));

    } finally {
      setBtnLoading(false);
    }
  };


  const handleJdFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be 10MB or smaller");
      return;
    }
    setJdFile(file);
  };

  // Deep links from the job detail page: ?applicants=<jobId> opens the
  // Manage Applicants panel, ?job=<jobId> opens the edit dialog. Guarded by a
  // ref so re-renders (or a refetch after saving) don't reopen the panel.
  const deepLinkHandled = useRef(false);

  useEffect(() => {
    if (deepLinkHandled.current || !company?.jobs || !isRecruiterOwner) return;

    const params = new URLSearchParams(window.location.search);
    const applicantsId = params.get("applicants");
    const editId = params.get("job");
    const target = applicantsId ?? editId;
    if (!target) return;

    const job = company.jobs.find((j) => String(j.job_id) === target);
    if (!job) return;

    deepLinkHandled.current = true;
    if (applicantsId) {
      openManageApplicants(job);
    } else {
      handleOpenUpdateModal(job);
    }
  }, [company, isRecruiterOwner]);

  // Shared between the Add and Update dialogs — both bind to the same
  // state variables, matching this file's existing convention.
  const jobFormFields = (
    <div className="space-y-6 py-2">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase opacity-60">
          Basics
        </h3>
        <div className="space-y-2">
          <Label
            htmlFor="title"
            className="text-sm font-medium flex items-center gap-2"
          >
            <Briefcase size={16} /> Job Title *
          </Label>
          <Input
            id="title"
            type="text"
            placeholder="Enter Job title"
            className="h-11"
            value={title}
            onChange={(e) => settitle(e.target.value)}
          />
          <FieldError message={errors.title} />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="description"
            className="text-sm font-medium flex items-center gap-2"
          >
            <FileText size={16} /> Description *
          </Label>
          <Input
            id="description"
            type="text"
            placeholder="Enter Description"
            className="h-11"
            value={description}
            onChange={(e) => setdescription(e.target.value)}
          />
          <FieldError message={errors.description} />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="role"
            className="text-sm font-medium flex items-center gap-2"
          >
            <Building2 size={16} /> Role/Department *
          </Label>
          <Input
            id="role"
            type="text"
            placeholder="Enter Job Role"
            className="h-11"
            value={role}
            onChange={(e) => setrole(e.target.value)}
          />
          <FieldError message={errors.role} />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="location"
            className="text-sm font-medium flex items-center gap-2"
          >
            <MapPin size={16} /> Location *
          </Label>
          <Input
            id="location"
            type="text"
            placeholder="Enter location"
            className="h-11"
            value={location}
            onChange={(e) => setlocation(e.target.value)}
          />
          <FieldError message={errors.location} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              <Clock size={16} /> Job Type *
            </Label>
            <Select value={job_type} onValueChange={setjob_type}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select job type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Full-time">Full-time</SelectItem>
                <SelectItem value="Part-time">Part-time</SelectItem>
                <SelectItem value="Contract">Contract</SelectItem>
                <SelectItem value="Internship">Internship</SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={errors.job_type} />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              <Laptop size={16} /> Work Mode *
            </Label>
            <Select value={work_location} onValueChange={setwork_location}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select work mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="On-site">On-site</SelectItem>
                <SelectItem value="Remote">Remote</SelectItem>
                <SelectItem value="Hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={errors.work_location} />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase opacity-60">
          Compensation & Timeline
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <DollarSign size={16} /> Salary / CTC (Annual) *
            </Label>
            <Input
              type="number"
              placeholder="Enter salary"
              className="h-11"
              value={salary}
              onChange={(e) => setsalary(e.target.value)}
            />
            <FieldError message={errors.salary} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Users size={16} /> Requirement (openings) *
            </Label>
            <Input
              type="number"
              placeholder="Eg. 5"
              className="h-11"
              value={openings}
              onChange={(e) => setopenings(e.target.value)}
            />
            <FieldError message={errors.openings} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">CTC Range Min</Label>
            <Input
              type="number"
              placeholder="Optional"
              className="h-11"
              value={ctcMin}
              onChange={(e) => setCtcMin(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">CTC Range Max</Label>
            <Input
              type="number"
              placeholder="Optional"
              className="h-11"
              value={ctcMax}
              onChange={(e) => setCtcMax(e.target.value)}
            />
          </div>
        </div>

        {job_type === "Internship" && (
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Wallet size={16} /> Monthly Stipend
            </Label>
            <Input
              type="number"
              placeholder="Optional"
              className="h-11"
              value={stipend}
              onChange={(e) => setStipend(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Calendar size={16} /> Apply-by Deadline *
          </Label>
          <Input
            type="date"
            className="h-11"
            value={applyBy}
            onChange={(e) => setApplyBy(e.target.value)}
          />
          <FieldError message={errors.applyBy} />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase opacity-60">
          Requirements
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Role Type *</Label>
            <Input
              placeholder="Internship / Full-Time / PPO"
              className="h-11"
              value={roleType}
              onChange={(e) => setRoleType(e.target.value)}
            />
            <FieldError message={errors.roleType} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Duration *</Label>
            <Input
              placeholder="e.g. 6 months"
              className="h-11"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <FieldError message={errors.duration} />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <GraduationCap size={16} /> Qualification *
          </Label>
          <Input
            placeholder="e.g. B.Tech in CS/IT (Final Semester)"
            className="h-11"
            value={qualification}
            onChange={(e) => setQualification(e.target.value)}
          />
          <FieldError message={errors.qualification} />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Working Days *</Label>
          <Input
            placeholder="e.g. 5 Days (Mon-Fri)"
            className="h-11"
            value={workingDays}
            onChange={(e) => setWorkingDays(e.target.value)}
          />
          <FieldError message={errors.workingDays} />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <ShieldCheck size={16} /> Eligibility Criteria
          </Label>
          <Input
            placeholder="e.g. Minimum 7.0 CGPA, no active backlogs"
            className="h-11"
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Award size={16} /> Category
            </Label>
            <Input
              placeholder="e.g. Dream"
              className="h-11"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Eligible Gender</Label>
            <Input
              placeholder="e.g. Any"
              className="h-11"
              value={eligibleGender}
              onChange={(e) => setEligibleGender(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Grad Years</Label>
            <Input
              placeholder="e.g. 2027"
              className="h-11"
              value={eligibleGradYears}
              onChange={(e) => setEligibleGradYears(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Conversion Note</Label>
          <Input
            placeholder="e.g. Intern Leads to Full Time"
            className="h-11"
            value={conversionNote}
            onChange={(e) => setConversionNote(e.target.value)}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Min Hires</Label>
            <Input
              type="number"
              placeholder="Optional"
              className="h-11"
              value={minHires}
              onChange={(e) => setMinHires(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Expected Offers</Label>
            <Input
              type="number"
              placeholder="Optional"
              className="h-11"
              value={expectedOffers}
              onChange={(e) => setExpectedOffers(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase opacity-60">
          Hiring Process *
        </h3>
        <p className="text-xs opacity-60">
          Define the ordered pipeline candidates go through. This drives both
          the Job Detail stepper and the applicant Tracker.
        </p>
        <RoundsBuilder rounds={rounds} onChange={setRounds} />
        <FieldError message={errors.rounds} />
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Skills Required *</Label>
          <ChipInput
            values={skills}
            onChange={setSkills}
            placeholder="e.g. React, Node.js"
          />
          <FieldError message={errors.skills} />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Job Tags</Label>
          <ChipInput
            values={tags}
            onChange={setTags}
            placeholder="e.g. Backend, Remote"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Custom Application Questions
          </Label>
          <ChipInput
            values={questions}
            onChange={setQuestions}
            placeholder="Type a question and press Add"
            suggestions={SUGGESTED_APPLICATION_QUESTIONS}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Upload size={16} /> Job Description PDF{" "}
          {!selectedJob && <span>*</span>}
        </Label>
        {existingAttachments.length > 0 && (
          <div className="space-y-1 mb-2">
            {existingAttachments.map((a) => (
              <div
                key={a.attachment_id}
                className="flex items-center gap-2 text-xs opacity-70"
              >
                <FileText size={12} /> {a.file_name} (already uploaded)
              </div>
            ))}
          </div>
        )}
        <Input
          type="file"
          accept="application/pdf"
          className="h-11 cursor-pointer"
          onChange={handleJdFileChange}
        />
        <p className="text-xs opacity-60">PDF only, max 10MB.</p>
        <FieldError message={errors.jdFile} />
      </div>
    </div>
  );

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-secondary/30">
      {company && (
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Card className="overflow-hidden shadow-lg border-2 mb-8">
            <div className="h-32 bg-blue-600"></div>
            <div className="px-8 pb-8">
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-end -mt-16">
                <CompanyLogo
                  name={company.name}
                  src={company.logo}
                  className="size-32 rounded-2xl border-4 border-background shadow-xl shrink-0"
                  textClassName="text-4xl"
                />

                <div className="flex-1 md:mb-4">
                  <h1 className="text-3xl font-bold mb-2">{company.name}</h1>
                  <p className="text-base leading-relaxed opacity-80 max-w-3xl">
                    {company.description}
                  </p>
                </div>
                <Link
                  href={company.website}
                  target="_blank"
                  className="md:mb-4"
                >
                  <Button className="gap-2">
                    <Building2 size={18} />
                    Visit Website
                  </Button>
                </Link>
              </div>
            </div>
          </Card>

          <Dialog>
            {/* Job section */}
            <Card className="shadow-lg border-2 overflow-hidden">
              <div className="bg-blue-600 border-b p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Briefcase size={20} className="text-blue-600" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-white">
                    Open Positions
                  </h2>
                  <p className="text-sm opacity-70 text-white">
                    {company.jobs?.length || 0} active job
                    {company.jobs?.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {isRecruiterOwner && (
                <>
                  <div className="p-4 border-b">
                    <DialogTrigger asChild>
                      <Button className="gap-2" onClick={clearInput}>
                        <Plus size={18} />
                        Post New Job
                      </Button>
                    </DialogTrigger>
                  </div>

                  <DialogContent className="sm:max-w-162.5 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-2xl flex items-center gap-2">
                        Post a new Job
                      </DialogTitle>
                    </DialogHeader>

                    {jobFormFields}

                    <DialogFooter>
                      <DialogClose asChild>
                        <Button ref={addModalRef} variant={"outline"}>
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button
                        disabled={btnLoading}
                        onClick={addJobHandler}
                        className="gap-2"
                      >
                        {btnLoading ? "Posting job..." : "Post Job"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </>
              )}

              <div className="p-6">
                {company.jobs && company.jobs.length > 0 ? (
                  <div className="space-y-4">
                    {company.jobs.map((j) => (
                      <div
                        key={j.job_id}
                        className="p-5 rounded-lg border-2 hover:border-blue-500 transition-all bg-background"
                      >
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-3 flex-wrap">
                              <h3 className="text-xl font-semibold">
                                {j.title}
                              </h3>

                              <span
                                className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 ${
                                  j.is_active
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-600"
                                }`}
                              >
                                {j.is_active ? (
                                  <CheckCircle size={14} />
                                ) : (
                                  <XCircle size={14} />
                                )}
                                {j.is_active ? "Active" : "Inactive"}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
                              <div className="flex items-center gap-2 opacity-70">
                                <Building2 size={16} />
                                <span>{j.role}</span>
                              </div>
                              <div className="flex items-center gap-2 opacity-70">
                                <DollarSign size={16} />
                                <span>
                                  {j.salary
                                    ? `₹ ${j.salary.toLocaleString()}`
                                    : "Not Disclosed"}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 opacity-70">
                                <MapPin size={16} />
                                <span>{j.location}</span>
                              </div>
                              <div className="flex items-center gap-2 opacity-70">
                                <Laptop size={16} />
                                <span>
                                  {j.work_location} ({j.job_type})
                                </span>
                              </div>
                              <div className="flex items-center gap-2 opacity-70">
                                <Users size={16} />
                                <span>{j.openings} openings</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Link href={`/jobs/${j.job_id}`}>
                              <Button
                                variant={"outline"}
                                size={"sm"}
                                className="gap-2"
                              >
                                <Eye size={16} /> View
                              </Button>
                            </Link>

                            {isRecruiterOwner && (
                              <>
                                <Button
                                  onClick={() => openManageApplicants(j)}
                                  variant={"outline"}
                                  size={"sm"}
                                  className="gap-2"
                                  disabled={manageLoading}
                                >
                                  <Users2 size={16} />
                                  Manage Applicants
                                </Button>
                                <Button
                                  onClick={() => handleOpenUpdateModal(j)}
                                  variant={"outline"}
                                  size={"sm"}
                                  className="gap-2"
                                  disabled={loadingJobDetail}
                                >
                                  <Pencil size={16} />
                                  Edit
                                </Button>
                                <Button
                                  onClick={() => deleteHandler(j.job_id)}
                                  variant={"outline"}
                                  size={"sm"}
                                  className="gap-2 text-red-500 hover:text-red-600"
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                        <Briefcase size={32} className="opacity-40" />
                      </div>
                      <p className="text-base opacity-70 mb-2">
                        No jobs postet yet
                      </p>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </Dialog>

          <Dialog open={isUpdatedModalOpen} onOpenChange={setIsUpdatedModalOpen}>
            <DialogContent className="sm:max-w-162.5 max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center gap-2">
                  Update Job
                </DialogTitle>
              </DialogHeader>

              {jobFormFields}

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  {is_active ? (
                    <CheckCircle size={16} className="text-green-600" />
                  ) : (
                    <XCircle size={16} className="text-gray-500" />
                  )}
                  Status
                </Label>
                <Select
                  value={is_active ? "true" : "false"}
                  onValueChange={(value) => setis_active(value === "true")}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  ref={updateModalRef}
                  variant={"outline"}
                  onClick={handleCloseUpdateModal}
                >
                  Cancel
                </Button>
                <Button
                  disabled={btnLoading}
                  onClick={updateJobHandler}
                  className="gap-2"
                >
                  {btnLoading ? "Updating job..." : "Update Job"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={!!manageJob}
            onOpenChange={(open) => !open && setManageJob(null)}
          >
            <DialogContent className="sm:max-w-162.5 max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center gap-2">
                  <Users2 size={22} /> Manage Applicants
                </DialogTitle>
              </DialogHeader>

              {manageLoading ? (
                <p className="text-sm opacity-60 py-6 text-center">
                  Loading applicants...
                </p>
              ) : manageJob && manageJob.rounds.length === 0 ? (
                <p className="text-sm opacity-60 py-6 text-center">
                  This job has no hiring rounds defined yet, so stages can&apos;t
                  be tracked.
                </p>
              ) : (
                <div className="space-y-5 py-2">
                  {manageApplications.length === 0 ? (
                    <p className="text-sm opacity-60 text-center py-6">
                      No applicants yet.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                      {manageApplications.map((a) => (
                        <label
                          key={a.application_id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedAppIds.includes(a.application_id)}
                            onCheckedChange={() =>
                              toggleSelectedApp(a.application_id)
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {a.applicant_email}
                            </p>
                            <p className="text-xs opacity-60">
                              Applied{" "}
                              {new Date(a.applied_at).toLocaleDateString(
                                "en-US",
                                { day: "numeric", month: "short" }
                              )}{" "}
                              • {a.status}
                            </p>
                            {a.answers && a.answers.length > 0 && (
                              <details
                                className="mt-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <summary className="text-xs text-blue-500 cursor-pointer hover:underline">
                                  {a.answers.length} answer
                                  {a.answers.length === 1 ? "" : "s"}
                                </summary>
                                <div className="mt-2 space-y-2 pl-1 border-l-2">
                                  {a.answers.map((ans) => (
                                    <div key={ans.question_id} className="pl-3">
                                      <p className="text-xs opacity-60">
                                        {ans.question_text}
                                      </p>
                                      <p className="text-xs whitespace-pre-wrap">
                                        {ans.answer_text}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                          <Link
                            href={a.resume}
                            target="_blank"
                            className="text-xs text-blue-500 hover:underline shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {a.resume_name || "Resume"}
                          </Link>
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Advance to Round
                      </Label>
                      <Select value={stageRoundId} onValueChange={setStageRoundId}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select round" />
                        </SelectTrigger>
                        <SelectContent>
                          {manageJob?.rounds.map((r) => (
                            <SelectItem
                              key={r.round_id}
                              value={String(r.round_id)}
                            >
                              {r.round_order}. {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Status</Label>
                      <Select value={stageStatus} onValueChange={setStageStatus}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_progress">
                            In Progress
                          </SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Note (optional)
                    </Label>
                    <Input
                      placeholder="e.g. Great communication skills"
                      className="h-11"
                      value={stageNote}
                      onChange={(e) => setStageNote(e.target.value)}
                    />
                  </div>

                  <p className="text-xs opacity-60">
                    {`${selectedAppIds.length} applicant${
                      selectedAppIds.length !== 1 ? "s" : ""
                    } selected.`}{" "}
                    Marking the final round &quot;Completed&quot; auto-hires;
                    marking any round &quot;Rejected&quot; auto-rejects.
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button variant={"outline"} onClick={() => setManageJob(null)}>
                  Close
                </Button>
                <Button
                  disabled={stageSubmitting}
                  onClick={submitStageUpdate}
                  className="gap-2"
                >
                  <Send size={16} />
                  {stageSubmitting ? "Updating..." : "Update Stage"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
};

export default CompanyPage;
