"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "../ui/button";
import api from "@/lib/axios";
import { FiGrid, FiUsers, FiLogOut, FiPlusCircle } from "react-icons/fi";

import { IoGameControllerOutline } from "react-icons/io5";
import { MdOutlinePayments } from "react-icons/md";
import { RiSearchLine } from "react-icons/ri";
import { BsCollection } from "react-icons/bs";
import { toast } from "sonner";

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    {
      name: "Dashboard",
      href: "/admin",
      icon: FiGrid,
    },
    {
      name: "Products",
      href: "/admin/add-client",
      icon: FiPlusCircle,
    },
    {
      name: "Categories",
      href: "/admin/clients",
      icon: FiUsers,
    },
  ];

  const handleLogout = async () => {
    try {
      const res = await api.post("/api/auth/logout");

      if (res.data.success) {
        toast.success("Logged out successfully");
        router.push("/");
      } else {
        toast.error("Logout failed");
      }
    } catch (error) {
      toast.error("Something went wrong");
    }
  };

  return (
    <aside className="hidden md:flex h-screen w-72 bg-background border-r border-border px-4 py-6 flex-col justify-between">
      <div>
        <div className="text-primary text-2xl font-semibold text-left ml-5 mb-8">
          Makextra
          <p className="text-sm text-gray-400 font-medium">Admin Panel</p>
        </div>

        <nav className="space-y-3">
          {navItems.map((item) => {
            const Icon = item.icon;

            const isActive = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-4 px-5 py-3 rounded-xl transition-all duration-300",

                  isActive
                    ? "border border-primary bg-primary/10 shadow-md shadow-primary/20"
                    : "hover:bg-primary/5",
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-9 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                )}

                <Icon
                  className={cn(
                    "text-lg transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-primary",
                  )}
                />

                <span
                  className={cn(
                    "font-medium transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <Button
        onClick={handleLogout}
        variant="outline"
        className="w-full flex items-center gap-2 rounded-full"
      >
        <FiLogOut />
        Logout
      </Button>
    </aside>
  );
}
