import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
	const user = getCurrentUser(req);
	if (!user) {
		return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
	}
	return NextResponse.json({ success: true, user });
}




