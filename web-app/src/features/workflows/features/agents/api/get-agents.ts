import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export default function useGetAgentsQuery() {
    return useQuery({
        queryKey: ["agents"],
        queryFn: () => api.workflows.getAgents(),
    });
}
