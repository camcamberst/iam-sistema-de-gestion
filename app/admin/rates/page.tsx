"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { canEditUser, canDeleteUser, getAvailableGroups } from "../../../lib/hierarchy";
import ActiveRatesPanel from "../../../components/ActiveRatesPanel";
import ReferenceRatesPanel from "../../../components/ReferenceRatesPanel";

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

interface UserInfo {
	id: string;
	name: string;
	email: string;
	role: 'super_admin' | 'admin' | 'modelo';
	groups: string[];
}

export default function RatesPage() {
	const router = useRouter();
	const [rates, setRates] = useState<RateItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
	const [authLoading, setAuthLoading] = useState(true);

	const supabase = createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL as string,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
	);

	// ===========================================
	// 🔐 VALIDACIÓN DE AUTENTICACIÓN Y ROLES
	// ===========================================
	useEffect(() => {
		let isMounted = true;
		
		async function checkAuth() {
			try {
				console.log('🔍 Iniciando verificación de autenticación...');
				setAuthLoading(true);
				
				// Verificar autenticación
				const { data: auth, error: authError } = await supabase.auth.getUser();
				console.log('🔐 Auth result:', { auth, authError });
				
				if (authError || !auth?.user?.id) {
					console.log('❌ No autenticado, redirigiendo...');
					if (isMounted) router.push('/');
					return;
				}

				// Obtener información del usuario
				const { data: userRow, error: userError } = await supabase
					.from('users')
					.select('id,name,email,role')
					.eq('id', auth.user.id)
					.single();

				console.log('👤 User data:', { userRow, userError });

				if (userError || !userRow) {
					console.log('❌ Usuario no encontrado, redirigiendo...');
					if (isMounted) router.push('/');
					return;
				}

				// Verificar que sea admin o super_admin
				if (userRow.role !== 'super_admin' && userRow.role !== 'admin') {
					console.log('❌ Rol no autorizado:', userRow.role);
					if (isMounted) router.push('/admin/dashboard');
					return;
				}

				// Obtener grupos si es admin
				let groups: string[] = [];
				if (userRow.role === 'admin') {
					const { data: ug, error: groupsError } = await supabase
						.from('user_groups')
						.select('groups(name)')
						.eq('user_id', auth.user.id);
					
					console.log('👥 Groups data:', { ug, groupsError });
					groups = (ug || []).map((r: any) => r.groups?.name).filter(Boolean);
				}

				const userInfoData = {
					id: userRow.id,
					name: userRow.name,
					email: userRow.email,
					role: userRow.role as 'super_admin' | 'admin' | 'modelo',
					groups
				};

				console.log('✅ Usuario autorizado:', userInfoData);

				if (isMounted) {
					setUserInfo(userInfoData);
				}

			} catch (err) {
				console.error('❌ Error de autenticación:', err);
				if (isMounted) router.push('/');
			} finally {
				if (isMounted) {
					setAuthLoading(false);
				}
			}
		}

		checkAuth();

		return () => {
			isMounted = false;
		};
	}, []); // Remover dependencias para evitar loops

	const [form, setForm] = useState({
		scope: "global",
		kind: "USD_COP" as RateKind,
		value_effective: "",
		source: "manual",
	});

	const [availableScopes, setAvailableScopes] = useState<Array<{value: string, label: string}>>([]);

	async function loadRates() {
		if (!userInfo) return; // Solo cargar si el usuario está autenticado
		
		try {
			setLoading(true);
			setError(null);
			
			// Construir parámetros según jerarquía
			const params = new URLSearchParams();
			params.append('activeOnly', 'true');
			
			// Super Admin puede ver todos los scopes
			if (userInfo.role === 'super_admin') {
				// No agregar filtro de scope para super admin
			} else if (userInfo.role === 'admin') {
				// Admin solo puede ver rates de sus grupos
				if (userInfo.groups && userInfo.groups.length > 0) {
					userInfo.groups.forEach(group => {
						params.append('scope', `group:${group}`);
					});
				}
			}
			
			const res = await fetch(`/api/rates?${params.toString()}`);
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
		if (userInfo) {
			// ===========================================
			// 🏗️ APLICAR LÍMITES DE JERARQUÍA
			// ===========================================
			const scopes: Array<{value: string, label: string}> = [];
			
			if (userInfo.role === 'super_admin') {
				// Super Admin: puede gestionar RATES globales y por grupo
				scopes.push({ value: 'global', label: 'Global (todos los grupos)' });
				
				// Agregar opciones por grupo si el admin tiene grupos
				if (userInfo.groups && userInfo.groups.length > 0) {
					userInfo.groups.forEach(group => {
						scopes.push({ 
							value: `group:${group}`, 
							label: `Grupo: ${group}` 
						});
					});
				}
			} else if (userInfo.role === 'admin') {
				// Admin: solo puede gestionar RATES de sus grupos
				if (userInfo.groups && userInfo.groups.length > 0) {
					userInfo.groups.forEach(group => {
						scopes.push({ 
							value: `group:${group}`, 
							label: `Grupo: ${group}` 
						});
					});
				}
			}
			
			setAvailableScopes(scopes);
			
			// Establecer scope por defecto según jerarquía
			if (scopes.length > 0) {
				setForm(prev => ({ ...prev, scope: scopes[0].value }));
			}
			
			loadRates();
		}
	}, [userInfo]);

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

	// ===========================================
	// 🚫 PANTALLAS DE ESTADO
	// ===========================================
	if (authLoading) {
		return (
			<div className="p-6 space-y-6">
				<div className="apple-card text-center py-12">
					<div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
					<p className="text-gray-600">Verificando permisos...</p>
				</div>
			</div>
		);
	}

	if (!userInfo) {
		return (
			<div className="p-6 space-y-6">
				<div className="apple-card text-center py-12">
					<div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
						<span className="text-red-600 text-2xl">🚫</span>
					</div>
					<h2 className="text-xl font-semibold text-gray-900 mb-2">Acceso Denegado</h2>
					<p className="text-gray-600 mb-4">
						No tienes permisos para acceder a esta función.
					</p>
					<button 
						onClick={() => router.push('/admin/dashboard')}
						className="apple-button"
					>
						Volver al Dashboard
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-gray-900">Definir RATES</h1>
					<p className="text-sm text-gray-500 mt-1">
						{userInfo.role === 'super_admin' 
							? 'Puedes gestionar RATES globales y por grupo'
							: 'Solo puedes gestionar RATES de tus grupos asignados'
						}
					</p>
				</div>
				<div className="text-sm text-gray-500">
					Acceso: <span className="font-medium text-blue-600">
						{userInfo.role === 'super_admin' ? 'Super Admin' : 'Admin'}
					</span>
				</div>
			</div>

			<div className="apple-card">
				<h2 className="text-base font-medium mb-3">Establecer rates manual</h2>
				<form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
					<div>
						<label className="block text-xs text-gray-500 mb-1">Aplicar a</label>
						<select
							className="apple-input text-sm py-2 px-3 h-9 leading-tight"
							value={form.scope}
							onChange={(e) => setForm({ ...form, scope: e.target.value })}
						>
							{availableScopes.map(scope => (
								<option key={scope.value} value={scope.value}>
									{scope.label}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="block text-xs text-gray-500 mb-1">Divisa</label>
						<select
							className="apple-input text-sm py-2 px-3 h-9 leading-tight"
							value={form.kind}
							onChange={(e) => setForm({ ...form, kind: e.target.value as RateKind })}
						>
							<option value="USD_COP">USD→COP</option>
							<option value="EUR_USD">EUR→USD</option>
							<option value="GBP_USD">GBP→USD</option>
						</select>
					</div>
					<div>
						<label className="block text-xs text-gray-500 mb-1">Valor</label>
						<input
							type="number"
							step="any"
							className="apple-input text-sm py-2 px-3 h-9 leading-tight"
							value={form.value_effective}
							onChange={(e) => setForm({ ...form, value_effective: e.target.value })}
							required
						/>
					</div>
					<div className="flex gap-2">
						<button type="submit" className="apple-button text-sm py-2 px-3 h-9 min-w-[70px]">Guardar</button>
						<button type="button" className="apple-button-secondary text-sm py-2 px-3 h-9 min-w-[70px]" onClick={loadRates}>Refrescar</button>
					</div>
				</form>
				{error && <p className="text-red-600 text-xs mt-2">{error}</p>}
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<ActiveRatesPanel />
				<ReferenceRatesPanel />
			</div>
		</div>
	);
}
