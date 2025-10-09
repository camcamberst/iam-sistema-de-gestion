"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { canEditUser, canDeleteUser, getAvailableGroups } from "../../../lib/hierarchy";
import ActiveRatesPanel from "../../../components/ActiveRatesPanel";
import ReferenceRatesPanel from "../../../components/ReferenceRatesPanel";
import AppleDropdown from "@/components/ui/AppleDropdown";

type RateKind = "USD→COP" | "EUR→USD" | "GBP→USD";

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
	const [refreshTrigger, setRefreshTrigger] = useState(0);

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
		kind: "USD→COP" as RateKind,
		value: "",
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
		
		// Validación de TypeScript
		if (!userInfo) {
			setError("Usuario no autenticado");
			return;
		}
		
		try {
			setLoading(true);
			setError(null);
			const res = await fetch("/api/rates", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					scope: form.scope,
					kind: form.kind,
					value: Number(form.value),
					source: form.source,
					author_id: userInfo.id,
				}),
			});
			const data = await res.json();
			if (!data.success) throw new Error(data.error || "Error al crear tasa");
			
			// Limpiar formulario
			setForm({ ...form, value: "" });
			
			// Recargar datos automáticamente
			await loadRates();
			
			// Forzar actualización del ActiveRatesPanel
			setRefreshTrigger(prev => prev + 1);
			
			// Mostrar mensaje de éxito temporal
			setError(null);
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
			<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center pt-24">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
					<p className="mt-4 text-gray-600">Verificando permisos...</p>
				</div>
			</div>
		);
	}

	if (!userInfo) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center pt-24">
				<div className="relative bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-8 max-w-md">
					<div className="text-center">
						<div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
							<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
							</svg>
						</div>
						<h2 className="text-lg font-bold text-gray-900 mb-2">Acceso Denegado</h2>
						<p className="text-sm text-gray-600 mb-4">
							No tienes permisos para acceder a esta función.
						</p>
						<button 
							onClick={() => router.push('/admin/dashboard')}
							className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 text-sm shadow-md hover:shadow-lg transform hover:scale-105"
						>
							Volver al Dashboard
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-24">
				{/* Header */}
				<div className="mb-12">
					<div className="relative">
						<div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
						<div className="relative bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
							<div className="flex items-center justify-between">
								<div className="flex items-center space-x-3">
									<div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
										<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
										</svg>
									</div>
									<div>
										<h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
											Definir RATES
										</h1>
										<p className="mt-1 text-sm text-gray-600">
											{userInfo.role === 'super_admin' 
												? 'Puedes gestionar RATES globales y por grupo'
												: 'Solo puedes gestionar RATES de tus grupos asignados'
											}
										</p>
									</div>
								</div>
								<div className="text-xs text-gray-500 bg-blue-50/50 px-3 py-1 rounded-full">
									Acceso: <span className="font-medium text-blue-600">
										{userInfo.role === 'super_admin' ? 'Super Admin' : 'Admin'}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>

			<div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 mb-6">
				<div className="flex items-center space-x-2 mb-4">
					<div className="w-5 h-5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md flex items-center justify-center">
						<svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
						</svg>
					</div>
					<h2 className="text-base font-semibold text-gray-900">Establecer rates manual</h2>
				</div>
				<form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
					<div>
						<label className="block text-xs text-gray-500 mb-2">Aplicar a</label>
						<AppleDropdown
							options={availableScopes.map(scope => ({
								value: scope.value,
								label: scope.label
							}))}
							value={form.scope}
							onChange={(value) => setForm({ ...form, scope: value })}
							placeholder="Selecciona alcance"
							className="text-sm"
						/>
					</div>
					<div>
						<label className="block text-xs text-gray-500 mb-2">Divisa</label>
						<AppleDropdown
							options={[
								{ value: 'USD→COP', label: 'USD → COP' },
								{ value: 'EUR→USD', label: 'EUR → USD' },
								{ value: 'GBP→USD', label: 'GBP → USD' }
							]}
							value={form.kind}
							onChange={(value) => setForm({ ...form, kind: value as RateKind })}
							placeholder="Selecciona divisa"
							className="text-sm"
						/>
					</div>
					<div>
						<label className="block text-xs text-gray-500 mb-2">Valor</label>
						<input
							type="number"
							step="any"
							className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
							value={form.value}
							onChange={(e) => setForm({ ...form, value: e.target.value })}
							required
						/>
					</div>
					<div className="flex gap-3">
						<button 
							type="submit" 
							className="flex-1 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
						>
							Guardar
						</button>
						<button 
							type="button" 
							className="flex-1 px-6 py-3 text-sm font-medium text-blue-600 bg-white border border-blue-600 rounded-lg hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
							onClick={loadRates}
						>
							Refrescar
						</button>
					</div>
				</form>
				{error && <p className="text-red-600 text-xs mt-2">{error}</p>}
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<ActiveRatesPanel refreshTrigger={refreshTrigger} />
				<ReferenceRatesPanel />
			</div>
		</div>
	);
}
