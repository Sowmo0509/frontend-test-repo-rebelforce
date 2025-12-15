"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";
import { Check, X, Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { useTheme } from "next-themes";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  if (
    currentUser &&
    currentUser.role !== "ADMIN" &&
    currentUser.role !== "COMPLIANCE_OFFICER"
  ) {
    return <div>Access Denied</div>;
  }

  const {
    data: users,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/users");
        return data;
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Failed to load users");
        throw err;
      }
    },
    retry: 1,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/users/${id}/status`, { status });
    },
    onSuccess: (data, variables) => {
      const statusText =
        variables.status === "ACTIVE" ? "approved" : "rejected";
      toast.success(`User ${statusText} successfully`);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message || "Failed to update user status"
      );
    },
  });

  // Filter users by search and role
  const filteredUsers = users?.filter((u: any) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const activeUsers =
    filteredUsers?.filter((u: any) => u.status === "ACTIVE") || [];
  const pendingUsers =
    filteredUsers?.filter((u: any) => u.status === "PENDING") || [];

  // Get unique roles
  const roles = Array.from(new Set(users?.map((u: any) => u.role))) as string[];

  const UserTable = ({
    data,
    showActions,
  }: {
    data: any[];
    showActions?: boolean;
  }) => (
    <div className="rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            {showActions && (
              <TableHead className="text-right">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={showActions ? 5 : 4}
                className="h-24 text-center"
              >
                No users found.
              </TableCell>
            </TableRow>
          ) : (
            data.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="max-w-xs truncate">{user.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{user.role}</Badge>
                </TableCell>
                <TableCell>{format(new Date(user.createdAt), "PPP")}</TableCell>
                {showActions && (
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() =>
                        updateStatus.mutate({ id: user.id, status: "ACTIVE" })
                      }
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        updateStatus.mutate({ id: user.id, status: "REJECTED" })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  if (isLoading)
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin" />
      </div>
    );

  const containerStyle = { colorScheme: "light" };

  return (
    <div className="space-y-6" style={containerStyle}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-base text-muted-foreground">
            Manage system access and approvals.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="w-fit">
          <TabsTrigger value="active" className="text-sm">
            Active Users ({activeUsers.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-sm">
            Pending Approval ({pendingUsers.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4 space-y-4">
          <UserTable data={activeUsers} />
        </TabsContent>
        <TabsContent value="pending" className="mt-4 space-y-4">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  These users have requested access. Verify their identity
                  before approving.
                </p>
              </div>
            </div>
          </div>
          <UserTable data={pendingUsers} showActions />
        </TabsContent>
      </Tabs>
    </div>
  );
}
