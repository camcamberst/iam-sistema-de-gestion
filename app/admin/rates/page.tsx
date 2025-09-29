"use client";

import { useEffect, useState } from "react";

type RateKind = "USD_COP" | "EUR_USD" | "GBP_USD";

interface RateItem {
	id: string;
	scope: string;
	kind: RateKind;
	value_raw: number;
	adjustment: number;
	value_effective: number;
	source: string;
	author_id: string;
	valid_from: string;
	valid_to: string | null;
	period_base: boolean;
	created_at: string;
}

export default function RatesPage() {
	const [rates, setRates] = useState<RateItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [form, setForm] = useState({
		scope: "global",
		kind: "USD_COP" as RateKind,
		value_effective: "",
		source: "manual",
	});

	async function loadRates() {
		try {
			setLoading(true);
			setError(null);
			const res = await fetch("/api/rates?scope=global&activeOnly=true");
			const data = await res.json();
			if (!data.success) throw new Error(data.error || "Error al cargar tasas");
			setRates(data.data);
		} catch (err: any) {
			setError(err.message || "Error inesperado");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		loadRates();
	}, []);

	async function onCreate(e: React.FormEvent) {
		e.preventDefault();
		try {
			setLoading(true);
			setError(null);
			const res = await fetch("/api/rates", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					scope: form.scope,
					kind: form.kind,
					value_effective: Number(form.value_effective),
					source: form.source,
					author_id: "admin",
				}),
			});
			const data = await res.json();
			if (!data.success) throw new Error(data.error || "Error al crear tasa");
			setForm({ ...form, value_effective: "" });
			await loadRates();
		} catch (err: any) {
			setError(err.message || "Error inesperado");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="p-6 space-y-6">
			<h1 className="text-2xl font-semibold text-gray-900">Definir RATES</h1>

			<div className="apple-card">
				<h2 className="text-lg font-medium mb-4">Crear override manual</h2>
				<form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
					<div>
						<label className="block text-xs text-gray-500 mb-1">Scope</label>
						<select
							className="apple-input"
							value={form.scope}
							onChange={(e) => setForm({ ...form, scope: e.target.value })}
						>
							<option value="global">Global</option>
						</select>
					</div>
					<div>
						<label className="block text-xs text-gray-500 mb-1">Kind</label>
						<select
							className="apple-input"
							value={form.kind}
							onChange={(e) => setForm({ ...form, kind: e.target.value as RateKind })}
						>
							<option value="USD_COP">USD→COP</option>
							<option value="EUR_USD">EUR→USD</option>
							<option value="GBP_USD">GBP→USD</option>
						</select>
					</div>
					<div>
						<label className="block text-xs text-gray-500 mb-1">Valor efectivo</label>
						<input
							type="number"
							step="any"
							className="apple-input"
							value={form.value_effective}
							onChange={(e) => setForm({ ...form, value_effective: e.target.value })}
							required
						/>
					</div>
					<div className="flex gap-2">
						<button type="submit" className="apple-button">Guardar</button>
						<button type="button" className="apple-button-secondary" onClick={loadRates}>Refrescar</button>
					</div>
				</form>
				{error && <p className="text-red-600 text-sm mt-3">{error}</p>}
			</div>

			<div className="apple-card">
				<div className="flex items-center justify-between mb-3">
					<h2 className="text-lg font-medium">Tasas vigentes (mock)</h2>
					{loading && <span className="text-sm text-gray-500">Cargando…</span>}
				</div>
				<div className="overflow-x-auto apple-scroll">
					<table className="min-w-full text-sm">
						<thead className="text-left text-gray-500">
							<tr>
								<th className="py-2 pr-4">Kind</th>
								<th className="py-2 pr-4">Scope</th>
								<th className="py-2 pr-4">Valor efectivo</th>
								<th className="py-2 pr-4">Fuente</th>
								<th className="py-2 pr-4">Desde</th>
							</tr>
						</thead>
						<tbody>
							{rates.map((r) => (
								<tr key={r.id} className="border-t border-gray-200">
									<td className="py-2 pr-4 font-medium">{r.kind}</td>
									<td className="py-2 pr-4">{r.scope}</td>
									<td className="py-2 pr-4">{r.value_effective}</td>
									<td className="py-2 pr-4">{r.source}</td>
									<td className="py-2 pr-4">{new Date(r.valid_from).toLocaleString()}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
