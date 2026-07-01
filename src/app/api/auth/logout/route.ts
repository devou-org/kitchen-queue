import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  
  // Clear all possible authentication cookies securely
  response.cookies.delete('staff_token');
  response.cookies.delete('admin_token');
  response.cookies.delete('auth_token');
  
  return response;
}
