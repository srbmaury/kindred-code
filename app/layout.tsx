import type { Metadata } from "next";
import { DM_Sans, Space_Mono } from "next/font/google";
import "./globals.css";
const sans=DM_Sans({variable:"--font-sans",subsets:["latin"]});
const mono=Space_Mono({variable:"--font-mono",subsets:["latin"],weight:["400","700"]});
export const metadata:Metadata={title:"Kindred Code — Same stack. Shared spark.",description:"Find developers whose public GitHub activity overlaps with yours—and see exactly why you matched.",openGraph:{title:"Kindred Code — Same stack. Shared spark.",description:"Find your people in open source through shared repositories, languages, and topics.",type:"website"},twitter:{card:"summary",title:"Kindred Code — Same stack. Shared spark.",description:"Find your people in open source—and see exactly why you matched."}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body className={`${sans.variable} ${mono.variable}`}>{children}</body></html>}
