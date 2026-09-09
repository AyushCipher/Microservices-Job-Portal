"use client";
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { job_service, useAppData } from "@/context/AppContext";
import { Application, ApplicationStageHistoryEntry, Job } from "@/type";
import Loading from "@/components/loading";
import CompanyLogo from "@/components/company-logo";
import Stepper, { StepperStep } from "@/components/stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  LayoutGrid,
  List as ListIcon,
  MapPin,
  Search,
  Table as TableIcon,
} from "lucide-react";


const Tracker = () => {
  const { isAuth, user, applications, loading } = useAppData();
  const router = useRouter();
  const token = Cookies.get("token");

  useEffect(() => {
    if (!loading && !isAuth) {
      router.push("/login");
    }
  }, [loading, isAuth, router]);

  const [companySearch, setCompanySearch] = useState("");
  const [jobStatus, setJobStatus] = useState("all");
  const [jobType, setJobType] = useState("all");
  const [view, setView] = useState<"list" | "table">("list");

  const filtered = useMemo(() => {
    return (applications || []).filter((a) => {
      if (companySearch &&
        !a.company_name?.toLowerCase().includes(companySearch.toLowerCase())
      )
        return false;

      if (jobStatus !== "all" && a.status !== jobStatus) return false;
      
      if (jobType !== "all" && a.job_type !== jobType) return false;
      
      return true;
    });
  }, [applications, companySearch, jobStatus, jobType]);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedId && filtered.length > 0) {
      setSelectedId(filtered[0].application_id);
    }
  }, [filtered, selectedId]);

  const selected = (applications || []).find(
    (a) => a.application_id === selectedId
  );

  const [steps, setSteps] = useState<StepperStep[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    if (!selected) return;

    async function loadTimeline() {
      setTimelineLoading(true);
      try {
        // Fetch the job details and application history in parallel
        const [{ data: job }, { data: historyRes }] = await Promise.all([
          axios.get<Job>(`${job_service}/api/job/${selected!.job_id}`),
          axios.get<{ data: ApplicationStageHistoryEntry[] }>(
            `${job_service}/api/job/application/${selected!.application_id}/history`,
            { headers: { Authorization: `Bearer ${token}` } }
          ),
        ]);

        // Merge the job's full recruiter-defined pipeline with this
        // application's history so future rounds show up greyed out
        // instead of just disappearing because nothing has happened yet.
        const history = historyRes.data;
        const merged: StepperStep[] = job.rounds.map((round) => {
          const entries = history.filter((h) => h.round_id === round.round_id);
          const latest = entries[entries.length - 1];
          return {
            id: round.round_id,
            name: round.name,
            status: latest ? latest.status : "upcoming",
            timestamp: latest ? latest.changed_at : null,
          };
        });

        setSteps(merged);
        
      } catch (error) {
        console.log(error);
        setSteps([]);

      } finally {
        setTimelineLoading(false);
      }
    }

    loadTimeline();
  }, [selected, token]);

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1">Job Tracker</h1>
            <p className="text-sm opacity-70">
              {filtered.length} application{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="inline-flex rounded-lg border p-1 gap-1">
            <Button
              size="sm"
              variant={view === "list" ? "default" : "ghost"}
              className="gap-2"
              onClick={() => setView("list")}
            >
              <ListIcon size={14} /> List
            </Button>
            <Button
              size="sm"
              variant={view === "table" ? "default" : "ghost"}
              className="gap-2"
              onClick={() => setView("table")}
            >
              <TableIcon size={14} /> Table
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative w-full sm:w-64">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50"
            />
            <Input
              placeholder="Search company..."
              className="h-10 pl-9"
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
            />
          </div>
          <Select value={jobStatus} onValueChange={setJobStatus}>
            <SelectTrigger className="w-40 h-10">
              <SelectValue placeholder="Job Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Submitted">Submitted</SelectItem>
              <SelectItem value="Hired">Hired</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={jobType} onValueChange={setJobType}>
            <SelectTrigger className="w-40 h-10">
              <SelectValue placeholder="Job Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Full-time">Full-time</SelectItem>
              <SelectItem value="Part-time">Part-time</SelectItem>
              <SelectItem value="Contract">Contract</SelectItem>
              <SelectItem value="Internship">Internship</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
              <LayoutGrid size={32} className="opacity-40" />
            </div>
            <p className="text-base opacity-70">
              No applications match your filters yet.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-5 gap-6">
            {/* Left panel */}
            <Card className="md:col-span-2 p-0 overflow-hidden">
              <div className="max-h-[70vh] overflow-y-auto divide-y">
                {view === "list"
                  ? filtered.map((a) => (
                      <button
                        key={a.application_id}
                        onClick={() => setSelectedId(a.application_id)}
                        className={`w-full text-left p-4 flex items-center gap-3 hover:bg-secondary/50 transition-colors ${
                          selectedId === a.application_id
                            ? "bg-blue-50 dark:bg-blue-950/30"
                            : ""
                        }`}
                      >
                        <CompanyLogo
                          name={a.company_name}
                          src={a.company_logo}
                          className="size-11 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {a.company_name}
                          </p>
                          <p className="text-xs opacity-70 truncate">
                            {a.job_title}
                          </p>
                          <p className="text-xs opacity-50 mt-0.5">
                            {new Date(a.applied_at).toLocaleDateString(
                              "en-US",
                              { day: "numeric", month: "short", year: "numeric" }
                            )}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full shrink-0 font-medium ${
                            a.status === "Hired"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                              : a.status === "Rejected"
                              ? "bg-red-100 dark:bg-red-900/30 text-red-600"
                              : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600"
                          }`}
                        >
                          {a.status}
                        </span>
                      </button>
                    ))
                  : (
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/50 sticky top-0">
                          <tr className="text-left">
                            <th className="p-3 font-medium">Company</th>
                            <th className="p-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((a) => (
                            <tr
                              key={a.application_id}
                              onClick={() => setSelectedId(a.application_id)}
                              className={`cursor-pointer hover:bg-secondary/50 border-t ${
                                selectedId === a.application_id
                                  ? "bg-blue-50 dark:bg-blue-950/30"
                                  : ""
                              }`}
                            >
                              <td className="p-3">
                                <p className="font-medium">{a.company_name}</p>
                                <p className="text-xs opacity-60">
                                  {a.job_title}
                                </p>
                              </td>
                              <td className="p-3">{a.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
              </div>
            </Card>

            {/* Right panel */}
            <Card className="md:col-span-3 p-6">
              {selected ? (
                <>
                  <div className="flex items-start gap-4 mb-6">
                    <CompanyLogo
                      name={selected.company_name}
                      src={selected.company_logo}
                      className="size-14"
                    />
                    <div>
                      <h2 className="text-xl font-bold">
                        {selected.company_name}
                      </h2>
                      <p className="text-sm opacity-70">
                        {selected.job_title}
                      </p>
                      {selected.job_location && (
                        <p className="text-xs opacity-50 flex items-center gap-1 mt-1">
                          <MapPin size={12} /> {selected.job_location}
                        </p>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold uppercase opacity-60 mb-4">
                    Application Status
                  </h3>
                  {timelineLoading ? (
                    <p className="text-sm opacity-60">Loading timeline...</p>
                  ) : (
                    <Stepper steps={steps} orientation="timeline" />
                  )}
                </>
              ) : (
                <p className="text-sm opacity-60">
                  Select an application to see its progress.
                </p>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tracker;
