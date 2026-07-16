import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMyTicket, listMyTickets } from "../services/api";
import { useMyTicketEvents } from "../services/useEvents";
import type { MyTicket, TicketDetail } from "../lib/types";

export function MyTicketsPage() {
  const [tickets, setTickets] = useState<MyTicket[]>([]); const [error, setError] = useState<string>();
  const refresh = useCallback(() => { listMyTickets().then((r) => { setTickets(r.tickets); setError(undefined); }).catch((e: unknown) => setError(e instanceof Error ? e.message : "Unable to load tickets")); }, []);
  useEffect(() => { refresh(); }, [refresh]); useMyTicketEvents(true, refresh);
  return <main className="mx-auto max-w-2xl p-6"><h1 className="text-xl font-semibold">My tickets</h1>{error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}<ul className="mt-5 divide-y rounded border border-gray-200">{tickets.map((ticket) => <li key={ticket.reference} className="p-4"><Link className="font-mono text-sm font-semibold text-blue-600 hover:underline" to={`/tickets/${ticket.reference}`}>{ticket.reference}</Link><p className="mt-1 text-sm text-gray-700">{ticket.description}</p><p className="mt-1 text-xs text-gray-500">{ticket.status.replace("_", " ")} · {ticket.assigneeName ? `${ticket.assigneeName} is handling this` : "Awaiting assignment"}</p></li>)}</ul>{!error && tickets.length === 0 && <p className="mt-5 text-sm text-gray-500">You have not created any tickets yet. Start a chat to report an issue.</p>}</main>;
}

export function MyTicketDetailPage() {
  const { reference = "" } = useParams<{ reference: string }>(); const [ticket, setTicket] = useState<(MyTicket & TicketDetail) | null>(null); const [error, setError] = useState<string>();
  const load = useCallback(() => { getMyTicket(reference).then((result) => { setTicket(result.ticket); setError(undefined); }).catch((e: unknown) => setError(e instanceof Error ? e.message : "Unable to load ticket")); }, [reference]);
  useEffect(() => { load(); }, [load]); useMyTicketEvents(true, load);
  if (error) return <main className="mx-auto max-w-2xl p-6"><p role="alert" className="text-red-700">{error}</p><Link to="/tickets" className="mt-4 inline-block text-blue-600">Back to my tickets</Link></main>;
  if (!ticket) return <main className="mx-auto max-w-2xl p-6" aria-busy="true">Loading ticket…</main>;
  return <main className="mx-auto max-w-2xl p-6"><Link to="/tickets" className="text-sm text-blue-600">Back to my tickets</Link><h1 className="mt-3 font-mono text-xl font-semibold">{ticket.reference}</h1><p className="mt-2 text-gray-700">{ticket.description}</p><dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-gray-500">Status</dt><dd>{ticket.status.replaceAll("_", " ")}</dd></div><div><dt className="text-gray-500">Handler</dt><dd>{ticket.assigneeName ?? "Awaiting assignment"}</dd></div></dl><section className="mt-6"><h2 className="font-semibold">Updates</h2><ul className="mt-2 divide-y rounded border">{ticket.history.map((record, index) => <li key={`${record.at}-${index}`} className="p-3 text-sm">{record.field} changed from {record.from} to {record.to}<span className="block text-xs text-gray-500">{new Date(record.at).toLocaleString()}</span></li>)}</ul></section></main>;
}
