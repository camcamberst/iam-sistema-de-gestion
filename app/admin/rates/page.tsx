"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { canEditUser, canDeleteUser, getAvailableGroups } from "../../../lib/hierarchy";
import ActiveRatesPanel from "../../../components/ActiveRatesPanel";
import ReferenceRatesPanel from "../../../components/ReferenceRatesPanel";
import AppleDropdown from "@/components/ui/AppleDropdown";
import PageHeader from "@/components/ui/PageHeader";
import GlassCard from "@/components/ui/GlassCard";
import AdminWidgetsMobileCarousel from "@/components/ui/AdminWidgetsMobileCarousel";

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

	const supabase = require('@/lib/supabase').supabase;

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
			<div className="max-w-screen-2xl mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[40vh]">
				<div className="animate-spin w-8 h-8 border-2 border-indigo-500/80 border-t-transparent rounded-full mx-auto mb-4"></div>
				<p className="text-sm font-medium text-gray-500 dark:text-gray-400 tracking-wide">Verificando permisos...</p>
			</div>
		);
	}

	if (!userInfo) {
		return (
			<div className="max-w-screen-2xl mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[40vh] text-center">
				<div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
					<svg className="w-6 h-6 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
				</div>
				<h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Acceso Denegado</h3>
				<p className="text-sm text-gray-600 dark:text-gray-400 mb-6">No se pudo cargar la información del usuario.</p>
				<button 
					onClick={() => router.push('/admin/dashboard')}
					className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md"
				>
					Volver al Dashboard
				</button>
			</div>
		);
	}

	return (
		<>
			<div className="max-w-screen-2xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16">
			{/* Header */}
			<PageHeader 
				title="Rates (Presente)"
				subtitle={userInfo.role === 'super_admin' ? 'Puedes gestionar RATES globales y por grupo' : 'Solo puedes gestionar RATES de tus grupos asignados'}
				icon={
					<svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
					</svg>
				}
			/>

			{/* Formulario Establecer rates manual */}
				<div className="mb-8 relative z-[9997]">
					{/* TÍTULO POR FUERA */}
					<div className="flex items-center space-x-1.5 mb-2 px-1">
						<div className="flex items-center justify-center text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
							<svg className="w-[1.125rem] h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
							</svg>
						</div>
						<h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
							Definir Rates
						</h2>
					</div>
					<GlassCard padding="md" variant="card">
						<form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
							<div>
								<label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Aplicar a</label>
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
								<label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Divisa</label>
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
								<label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Valor</label>
								<input
									type="number"
									step="any"
									className="apple-input w-full"
									value={form.value}
									onChange={(e) => setForm({ ...form, value: e.target.value })}
									required
								/>
							</div>
							<div className="flex items-center">
								<button 
									disabled={loading}
									type="submit" 
									className="w-full btn-apple-primary"
								>
									{loading ? 'Guardando...' : 'Guardar'}
								</button>
							</div>
						</form>
						{error && (
							<div className="mt-4 p-3 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border border-red-200/50 dark:border-red-800/50 rounded-lg">
								<p className="text-red-600 dark:text-red-400 text-xs">{error}</p>
							</div>
						)}
					</GlassCard>
				</div>

				{/* Paneles de Tasas */}
				<AdminWidgetsMobileCarousel
					desktopChildren={
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-0">
							<ActiveRatesPanel refreshTrigger={refreshTrigger} />
							<ReferenceRatesPanel />
						</div>
					}
					mobileChildren={[
						<ActiveRatesPanel key="active" refreshTrigger={refreshTrigger} />,
						<ReferenceRatesPanel key="reference" />
					]}
				/>
			</div>
		</>
	);
}
