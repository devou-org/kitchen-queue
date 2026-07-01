import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  
  let type = 'all';
  try {
    const body = await request.json();
    if (body.type) type = body.type;
  } catch (e) {
    // Ignore JSON parse errors if body is empty
  }
  
  if (type === 'staff' || type === 'all') {
    response.cookies.delete('staff_token');
  }
  
  if (type === 'admin' || type === 'all') {
    response.cookies.delete('admin_token');
    response.cookies.delete('admin_refresh_token');
    response.cookies.delete('admin_logged_in');
  }
  
  if (type === 'customer' || type === 'all') {
    response.cookies.delete('auth_token');
    response.cookies.delete('refresh_token');
  }
  
  return response;
}
