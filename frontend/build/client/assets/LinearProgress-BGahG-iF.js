import{i as e,t}from"./react-B8IZ02wI.js";import{t as n}from"./jsx-runtime-fBfwind-.js";import{E as r,T as i,s as a}from"./createTheme-CP-DPEC3.js";import{r as o,t as s}from"./DefaultPropsProvider-BlLYnZrj.js";import{n as c,r as l}from"./Box-fDzbGWuk.js";import{n as u}from"./RtlProvider-CztOIY6k.js";import{A as d,P as f,S as p,T as m,a as h,k as g}from"./Typography-CDG8zr1j.js";var _=e(t(),1);function v(e){return l(`MuiLinearProgress`,e)}c(`MuiLinearProgress`,[`root`,`colorPrimary`,`colorSecondary`,`determinate`,`indeterminate`,`buffer`,`query`,`dashed`,`bar`,`bar1`,`bar2`]);var y=n(),b=4,x={},S=r`
  0% {
    left: -35%;
    right: 100%;
  }

  60% {
    left: 100%;
    right: -90%;
  }

  100% {
    left: 100%;
    right: -90%;
  }
`,C=typeof S==`string`?null:i`
        animation: ${S} 2.1s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite;
      `,w=r`
  0% {
    left: -200%;
    right: 100%;
  }

  60% {
    left: 107%;
    right: -8%;
  }

  100% {
    left: 107%;
    right: -8%;
  }
`,T=typeof w==`string`?null:i`
        animation: ${w} 2.1s cubic-bezier(0.165, 0.84, 0.44, 1) 1.15s infinite;
      `,E=r`
  0% {
    opacity: 1;
    background-position: 0 -23px;
  }

  60% {
    opacity: 0;
    background-position: 0 -23px;
  }

  100% {
    opacity: 1;
    background-position: -200px -23px;
  }
`,D=typeof E==`string`?null:i`
        animation: ${E} 3s infinite linear;
      `,O=e=>{let{classes:t,variant:n,color:r}=e;return f({root:[`root`,`color${g(r)}`,n],dashed:[`dashed`],bar1:[`bar`,`bar1`],bar2:[`bar`,`bar2`,n===`buffer`&&`color${g(r)}`]},v,t)},k=(e,t)=>e.vars?e.vars.palette.LinearProgress[`${t}Bg`]:e.palette.mode===`light`?e.lighten(e.palette[t].main,.62):e.darken(e.palette[t].main,.5),A=o(`span`,{name:`MuiLinearProgress`,slot:`Root`,overridesResolver:(e,t)=>{let{ownerState:n}=e;return[t.root,t[`color${g(n.color)}`],t[n.variant]]}})(d(({theme:e})=>({position:`relative`,overflow:`hidden`,display:`block`,height:4,zIndex:0,"@media print":{colorAdjust:`exact`},variants:[...Object.entries(e.palette).filter(h()).map(([t])=>({props:{color:t},style:{backgroundColor:k(e,t)}})),{props:({ownerState:e})=>e.color===`inherit`&&e.variant!==`buffer`,style:{"&::before":{content:`""`,position:`absolute`,left:0,top:0,right:0,bottom:0,backgroundColor:`currentColor`,opacity:.3}}},{props:{variant:`buffer`},style:{backgroundColor:`transparent`}},{props:{variant:`query`},style:{transform:`rotate(180deg)`}}]}))),j=o(`span`,{name:`MuiLinearProgress`,slot:`Dashed`})(d(({theme:e})=>({position:`absolute`,marginTop:0,height:`100%`,width:`100%`,backgroundSize:`10px 10px`,backgroundPosition:`0 -23px`,variants:[{props:{color:`inherit`},style:{opacity:.3,backgroundImage:`radial-gradient(currentColor 0%, currentColor 16%, transparent 42%)`}},...Object.entries(e.palette).filter(h()).map(([t])=>{let n=k(e,t);return{props:{color:t},style:{backgroundImage:`radial-gradient(${n} 0%, ${n} 16%, transparent 42%)`}}})]})),D||{animation:`${E} 3s infinite linear`},d(({theme:e})=>p(e,{animation:`none`})||x)),M=o(`span`,{name:`MuiLinearProgress`,slot:`Bar1`,overridesResolver:(e,t)=>[t.bar,t.bar1]})(d(({theme:e})=>{let t=p(e,{animation:`none`,left:`30%`,right:`auto`,width:`40%`});return{width:`100%`,position:`absolute`,left:0,bottom:0,top:0,...m(e,`transform`,{duration:`0.2s`,easing:`linear`}),transformOrigin:`left`,variants:[{props:{color:`inherit`},style:{backgroundColor:`currentColor`}},...Object.entries(e.palette).filter(h()).map(([t])=>({props:{color:t},style:{backgroundColor:(e.vars||e).palette[t].main}})),{props:{variant:`determinate`},style:{...m(e,`transform`,{duration:`.${b}s`,easing:`linear`})}},{props:{variant:`buffer`},style:{zIndex:1,...m(e,`transform`,{duration:`.${b}s`,easing:`linear`})}},{props:({ownerState:e})=>e.variant===`indeterminate`||e.variant===`query`,style:{width:`auto`}},{props:({ownerState:e})=>e.variant===`indeterminate`||e.variant===`query`,style:C||{animation:`${S} 2.1s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite`}},...t?[{props:({ownerState:e})=>e.variant===`indeterminate`||e.variant===`query`,style:t}]:[]]}})),N=o(`span`,{name:`MuiLinearProgress`,slot:`Bar2`,overridesResolver:(e,t)=>[t.bar,t.bar2]})(d(({theme:e})=>{let t=p(e,{animation:`none`,display:`none`});return{width:`100%`,position:`absolute`,left:0,bottom:0,top:0,...m(e,`transform`,{duration:`0.2s`,easing:`linear`}),transformOrigin:`left`,variants:[...Object.entries(e.palette).filter(h()).map(([t])=>({props:{color:t},style:{"--LinearProgressBar2-barColor":(e.vars||e).palette[t].main}})),{props:({ownerState:e})=>e.variant!==`buffer`&&e.color!==`inherit`,style:{backgroundColor:`var(--LinearProgressBar2-barColor, currentColor)`}},{props:({ownerState:e})=>e.variant!==`buffer`&&e.color===`inherit`,style:{backgroundColor:`currentColor`}},{props:{color:`inherit`},style:{opacity:.3}},...Object.entries(e.palette).filter(h()).map(([t])=>({props:{color:t,variant:`buffer`},style:{backgroundColor:k(e,t),...m(e,`transform`,{duration:`.${b}s`,easing:`linear`})}})),{props:({ownerState:e})=>e.variant===`indeterminate`||e.variant===`query`,style:{width:`auto`}},{props:({ownerState:e})=>e.variant===`indeterminate`||e.variant===`query`,style:T||{animation:`${w} 2.1s cubic-bezier(0.165, 0.84, 0.44, 1) 1.15s infinite`}},...t?[{props:({ownerState:e})=>e.variant===`indeterminate`||e.variant===`query`,style:t}]:[]]}})),P=_.forwardRef(function(e,t){let n=s({props:e,name:`MuiLinearProgress`}),{className:r,color:i=`primary`,max:o,min:c,value:l,valueBuffer:d,variant:f=`indeterminate`,...p}=n,m={...n,color:i,variant:f},h=c??0,g=o??100,_=O(m),v=u(),b={},x={bar1:{},bar2:{}};if((f===`determinate`||f===`buffer`)&&l!==void 0){let e=g-h,t=(l-h)/e*100-100;v&&(t=-t),x.bar1.transform=e>0?`translateX(${t}%)`:`translateX(-100%)`,b[`aria-valuenow`]=l,b[`aria-valuemin`]=h,b[`aria-valuemax`]=g}if(f===`buffer`&&d!==void 0){let e=g-h,t=(d-h)/e*100-100;v&&(t=-t),x.bar2.transform=e>0?`translateX(${t}%)`:`translateX(-100%)`}return(0,y.jsxs)(A,{className:a(_.root,r),ownerState:m,role:`progressbar`,...b,ref:t,...p,children:[f===`buffer`?(0,y.jsx)(j,{className:_.dashed,ownerState:m}):null,(0,y.jsx)(M,{className:_.bar1,ownerState:m,style:x.bar1}),f===`determinate`?null:(0,y.jsx)(N,{className:_.bar2,ownerState:m,style:x.bar2})]})});export{P as t};