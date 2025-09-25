import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
	try {
		const { email, password } = await req.json();
		if (!email || !password) {
			return NextResponse.json({ success: false, error: "Faltan credenciales" }, { status: 400 });
		}

		const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
		if (error || !data.session || !data.user) {
			return NextResponse.json({ success: false, error: error?.message || "Credenciales inválidas" }, { status: 401 });
		}

		const res = NextResponse.json({ success: true, user: { id: data.user.id, email: data.user.email } });
		setSessionCookie(res, {
			id: data.user.id,
			email: data.user.email || "",
			name: (data.user.user_metadata as any)?.name || "",
			role: "super_admin",
			groups: []
		});
		return res;
	} catch (err: any) {
		return NextResponse.json({ success: false, error: err.message || "Error" }, { status: 500 });
	}
}





