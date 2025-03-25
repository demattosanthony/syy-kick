export const orgInvitation = (
  inviter: {
    name: string;
    email: string;
  },
  invitationLink: string,
  organization: {
    name: string;
    logo?: string;
  }
) => {
  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <head>
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />
    <!--$-->
  </head>
  <div
    style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">
    Join ${inviter.name} on his organization
  </div>
  <body
    style='background-color:rgb(255,255,255);margin-top:auto;margin-bottom:auto;margin-left:auto;margin-right:auto;font-family:ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";padding-left:0.5rem;padding-right:0.5rem'>
    <table
      align="center"
      width="100%"
      border="0"
      cellpadding="0"
      cellspacing="0"
      role="presentation"
      style="border-width:1px;border-style:solid;border-color:rgb(234,234,234);border-radius:0.25rem;margin-top:40px;margin-bottom:40px;margin-left:auto;margin-right:auto;padding:20px;max-width:465px">
      <tbody>
        <tr style="width:100%">
          <td>
            <h1
              style="color:rgb(0,0,0);font-size:24px;font-weight:400;text-align:center;padding:0px;margin-top:30px;margin-bottom:30px;margin-left:0px;margin-right:0px">
              Join <strong>${organization.name ?? 'the organization'}</strong> on <strong>Yo.</strong>
            </h1>
            <p
              style="color:rgb(0,0,0);font-size:14px;line-height:24px;margin:16px 0">
              Hello,
            </p>
            <p
              style="color:rgb(0,0,0);font-size:14px;line-height:24px;margin:16px 0">
              <strong>${inviter.name}</strong> (<a
                href="mailto:${inviter.email}"
                style="color:rgb(37,99,235);text-decoration-line:none"
                target="_blank"
                >${inviter.email}</a
              >) has invited you to joins his team on<!-- -->
              <strong>Yo</strong>.
            </p>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="text-align:center;margin-top:32px;margin-bottom:32px">
              <tbody>
                <tr>
                  <td>
                    <a
                      href="${invitationLink}"
                      style="background-color:rgb(0,0,0);border-radius:0.25rem;color:rgb(255,255,255);font-size:12px;font-weight:600;text-decoration-line:none;text-align:center;padding-left:1.25rem;padding-right:1.25rem;padding-top:0.75rem;padding-bottom:0.75rem;line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px;padding:12px 20px 12px 20px"
                      target="_blank"
                      ><span
                        ><!--[if mso]><i style="mso-font-width:500%;mso-text-raise:18" hidden>&#8202;&#8202;</i><![endif]--></span
                      ><span
                        style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px;mso-text-raise:9px"
                        >Join the team</span
                      ><span
                        ><!--[if mso]><i style="mso-font-width:500%" hidden>&#8202;&#8202;&#8203;</i><![endif]--></span
                      ></a
                    >
                  </td>
                </tr>
              </tbody>
            </table>
            <p
              style="color:rgb(0,0,0);font-size:14px;line-height:24px;margin:16px 0">
              or copy and paste this URL into your browser:<!-- -->
              <a
                href="${invitationLink}"
                style="color:rgb(37,99,235);text-decoration-line:none"
                target="_blank"
                >${invitationLink}</a
              >
            </p>
          </td>
        </tr>
      </tbody>
    </table>
    <!--/$-->
  </body>
</html>
    `;
};
