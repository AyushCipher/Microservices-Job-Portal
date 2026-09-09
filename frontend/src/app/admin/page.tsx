"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import axios from "axios";
import toast from "react-hot-toast";
import { useAppData, user_service, job_service } from "@/context/AppContext";
import Loading from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Building2, ShieldAlert, Users } from "lucide-react";

interface AdminUser {
  user_id: number;
  name: string;
  email: string;
  phone_number: string;
  role: string;
  created_at: string;
}

interface AdminJob {
  job_id: number;
  title: string;
  company_name: string;
  recruiter_id: number;
  is_active: boolean;
}

interface AdminCompany {
  company_id: number;
  name: string;
  website: string;
  recruiter_id: number;
  job_count: number;
}

type Tab = "users" | "jobs" | "companies";

const PAGE_SIZE = 10;


const AdminPage = () => {
  const { isAuth, user, loading } = useAppData();
  const router = useRouter();
  const token = Cookies.get("token");

  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fetching, setFetching] = useState(false);

  const isAdmin = !loading && isAuth && user?.role === "admin";

  useEffect(() => {
    if (loading) return;

    if (!isAuth) {
      router.push("/login");
    } else if (user && user.role !== "admin") {
      router.push("/");
    }
  }, [isAuth, loading, user, router]);


  useEffect(() => {
    setPage(1);
  }, [tab]);


  // Fetch data based on the selected tab and current page
  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      setFetching(true);
      try {
        if (tab === "users") {
          const { data } = await axios.get(`${user_service}/api/user/admin/users?page=${page}&limit=${PAGE_SIZE}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setUsers(data.data);
          setTotalPages(data.pagination.totalPages);

        } else if (tab === "jobs") {
          const { data } = await axios.get(`${job_service}/api/job/admin/jobs?page=${page}&limit=${PAGE_SIZE}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setJobs(data.data);
          setTotalPages(data.pagination.totalPages);
        
        } else {
          const { data } = await axios.get(`${job_service}/api/job/admin/companies?page=${page}&limit=${PAGE_SIZE}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setCompanies(data.data);
          setTotalPages(data.pagination.totalPages);
        }

      } catch (error: any) {
        toast.error(error.response?.data?.message || "Failed to load data");
      
      } finally {
        setFetching(false);
      }
    };

    fetchData();
  }, [tab, page, isAdmin, token]);


  // Toggle job active status
  async function toggleJobActive(jobId: number, current: boolean) {
    try {
      await axios.put(`${job_service}/api/job/admin/jobs/${jobId}/active`,
        { is_active: !current },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`Job ${!current ? "activated" : "deactivated"}`);
      setJobs((prev) =>
        prev.map((j) => (j.job_id === jobId ? { ...j, is_active: !current } : j))
      );

    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update job");
    }
  }



  // Delete company and all its jobs 
  async function deleteCompany(companyId: number, name: string) {
    if (!window.confirm(
        `Delete company "${name}" and all its jobs? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await axios.delete(`${job_service}/api/job/company/${companyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Company deleted successfully");
      setCompanies((prev) => prev.filter((c) => c.company_id !== companyId));
    
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete company");
    }
  }

  if (!isAdmin) return <Loading />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <ShieldAlert className="text-red-500" size={32} />
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-sm opacity-60">
            Moderate users, jobs, and companies
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          variant={tab === "users" ? "default" : "outline"}
          onClick={() => setTab("users")}
          className="gap-2"
        >
          <Users size={16} /> Users
        </Button>
        <Button
          variant={tab === "jobs" ? "default" : "outline"}
          onClick={() => setTab("jobs")}
          className="gap-2"
        >
          <Briefcase size={16} /> Jobs
        </Button>
        <Button
          variant={tab === "companies" ? "default" : "outline"}
          onClick={() => setTab("companies")}
          className="gap-2"
        >
          <Building2 size={16} /> Companies
        </Button>
      </div>

      <Card>
        <CardContent>
          {fetching ? (
            <Loading />
          ) : (
            <>
              {tab === "users" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-4">ID</th>
                        <th className="py-2 pr-4">Name</th>
                        <th className="py-2 pr-4">Email</th>
                        <th className="py-2 pr-4">Phone</th>
                        <th className="py-2 pr-4">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.user_id} className="border-b last:border-0">
                          <td className="py-2 pr-4">{u.user_id}</td>
                          <td className="py-2 pr-4">{u.name}</td>
                          <td className="py-2 pr-4">{u.email}</td>
                          <td className="py-2 pr-4">{u.phone_number}</td>
                          <td className="py-2 pr-4 capitalize">{u.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && (
                    <p className="text-center py-8 opacity-60">
                      No users found
                    </p>
                  )}
                </div>
              )}

              {tab === "jobs" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-4">ID</th>
                        <th className="py-2 pr-4">Title</th>
                        <th className="py-2 pr-4">Company</th>
                        <th className="py-2 pr-4">Recruiter ID</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((j) => (
                        <tr key={j.job_id} className="border-b last:border-0">
                          <td className="py-2 pr-4">{j.job_id}</td>
                          <td className="py-2 pr-4">{j.title}</td>
                          <td className="py-2 pr-4">{j.company_name}</td>
                          <td className="py-2 pr-4">{j.recruiter_id}</td>
                          <td className="py-2 pr-4">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                j.is_active
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                              }`}
                            >
                              {j.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-2 pr-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                toggleJobActive(j.job_id, j.is_active)
                              }
                            >
                              {j.is_active ? "Deactivate" : "Activate"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {jobs.length === 0 && (
                    <p className="text-center py-8 opacity-60">
                      No jobs found
                    </p>
                  )}
                </div>
              )}

              {tab === "companies" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-4">ID</th>
                        <th className="py-2 pr-4">Name</th>
                        <th className="py-2 pr-4">Website</th>
                        <th className="py-2 pr-4">Recruiter ID</th>
                        <th className="py-2 pr-4">Jobs</th>
                        <th className="py-2 pr-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map((c) => (
                        <tr
                          key={c.company_id}
                          className="border-b last:border-0"
                        >
                          <td className="py-2 pr-4">{c.company_id}</td>
                          <td className="py-2 pr-4">{c.name}</td>
                          <td className="py-2 pr-4 max-w-40 truncate">
                            <a
                              href={c.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              {c.website}
                            </a>
                          </td>
                          <td className="py-2 pr-4">{c.recruiter_id}</td>
                          <td className="py-2 pr-4">{c.job_count}</td>
                          <td className="py-2 pr-4">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                deleteCompany(c.company_id, c.name)
                              }
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {companies.length === 0 && (
                    <p className="text-center py-8 opacity-60">
                      No companies found
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                Previous
              </Button>
              <span className="text-sm opacity-70">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPage;
