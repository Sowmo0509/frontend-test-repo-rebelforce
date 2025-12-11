"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ComplianceChart } from "@/components/dashboard/compliance-chart";
import { UpcomingDeadlines } from "@/components/dashboard/upcoming-deadlines";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useViewport, adaptiveLayout, getResponsiveSpacing, getCardLayout } from "@/lib/responsive-helpers";
import { cn } from "@/lib/utils";
import { normalizeApiResponse } from "@/lib/data-helpers";
import { Fund } from "@/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DashboardPage() {
  const viewport = useViewport();

  const {
    data: documents,
    isLoading: docsLoading,
    isError: docsError,
    error: docsErrorObj,
    refetch: refetchDocs,
  } = useQuery({
    queryKey: ["documents-all"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/documents");
        return data;
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || error.message || "Failed to load documents";
        if (!error.response || error.response.status !== 401) {
          toast.error(errorMessage);
        }
        throw error;
      }
    },
  });

  const {
    data: funds,
    isLoading: fundsLoading,
    isError: fundsError,
    error: fundsErrorObj,
    refetch: refetchFunds,
  } = useQuery({
    queryKey: ["funds-all"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/funds");
        return normalizeApiResponse(data) as any as Fund[];
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || error.message || "Failed to load funds";
        if (!error.response || error.response.status !== 401) {
          toast.error(errorMessage);
        }
        throw error;
      }
    },
  });

  const isLoading = docsLoading || fundsLoading;
  const bothFailed = docsError && fundsError;
  const hasPartialData = (documents && documents.length >= 0) || (funds && funds.length >= 0);

  // Show loading only if both are loading and we have no data
  if (isLoading && !hasPartialData && !bothFailed) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  // Only show full error screen if both queries failed and we have no data
  if (bothFailed && !hasPartialData) {
    const errorMessage = docsErrorObj && typeof docsErrorObj === "object" && "message" in docsErrorObj ? String(docsErrorObj.message) : fundsErrorObj && typeof fundsErrorObj === "object" && "message" in fundsErrorObj ? String(fundsErrorObj.message) : "Failed to load dashboard data";

    return (
      <div className="flex flex-col h-[50vh] items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Unable to load dashboard</h3>
          <p className="text-sm text-muted-foreground max-w-md">{errorMessage}</p>
        </div>
        <Button
          onClick={() => {
            refetchDocs();
            refetchFunds();
          }}
          variant="outline"
          className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  const layoutClasses = adaptiveLayout(viewport);
  const spacingClasses = getResponsiveSpacing(viewport);
  const cardLayout = getCardLayout(viewport);

  return (
    <div className={cn("w-full", spacingClasses)}>
      <div className={cn("flex gap-2", cardLayout, viewport.isMobile ? "flex-col" : "sm:flex-row sm:items-center sm:justify-between")}>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Welcome back to Audit Vault.</p>
        </div>
      </div>

      <div className={cn(layoutClasses, viewport.isMobile && "flex-col")}>
        <StatsCards documents={documents || []} funds={funds || []} />
      </div>

      <ComplianceChart documents={documents || []} />

      <div className={cn("grid gap-6", viewport.isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
        <UpcomingDeadlines />
      </div>

      <RecentActivity documents={documents || []} />
    </div>
  );
}
