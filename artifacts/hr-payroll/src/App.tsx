import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/layout/protected-route";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Employees from "@/pages/employees";
import EmployeeDetail from "@/pages/employee-detail";
import Departments from "@/pages/departments";
import Payroll from "@/pages/payroll";
import Leaves from "@/pages/leaves";

const queryClient = new QueryClient();

function RootRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Redirect to="/dashboard" />;
  return <Redirect to="/login" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRoute} />
      <Route path="/login" component={Login} />
      
      <Route path="/dashboard">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/employees">
        <ProtectedRoute><Employees /></ProtectedRoute>
      </Route>
      <Route path="/employees/:id">
        {params => <ProtectedRoute><EmployeeDetail id={parseInt(params.id)} /></ProtectedRoute>}
      </Route>
      <Route path="/departments">
        <ProtectedRoute><Departments /></ProtectedRoute>
      </Route>
      <Route path="/payroll">
        <ProtectedRoute><Payroll /></ProtectedRoute>
      </Route>
      <Route path="/leaves">
        <ProtectedRoute><Leaves /></ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
            <Toaster />
          </AuthProvider>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
