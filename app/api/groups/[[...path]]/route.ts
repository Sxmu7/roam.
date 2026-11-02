import {env} from 'cloudflare:workers';
import {handleGroups} from '../../../../server/groups.mjs';
export const dynamic='force-dynamic';
export function GET(request:Request){return handleGroups(request,env)}
export function POST(request:Request){return handleGroups(request,env)}
export function PUT(request:Request){return handleGroups(request,env)}
export function DELETE(request:Request){return handleGroups(request,env)}
