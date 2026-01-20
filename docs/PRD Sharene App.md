# PRD Sharene (temporary name) Controlled Photo Sharing App

## **Introduction**

### **Background Information / Context**

Photo sharing is a core behavior for parents, especially during early childhood. Most sharing happens through general-purpose messaging apps such as WhatsApp, iMessage, Telegram, and Signal because they are fast, familiar, and socially accepted. However, these platforms are designed for message delivery—not for managing the lifecycle, ownership, or downstream use of sensitive images.

When parents send a photo through a messaging app, they permanently relinquish control over that image. The image is transferred to third party services, recipients can download, forward, store indefinitely, or upload the image to other platforms. Current messaging apps lack a middle ground between features like view once, and the permanent hand over of the file . Private photo apps and encrypted storage services focus on secure storage and restricted access but require recipients to join a closed ecosystem and do not integrate well with everyday messaging behavior.

As awareness of children’s digital privacy grows, parents are increasingly uncomfortable with uncontrolled photo distribution but lack practical alternatives that balance privacy, usability, and social norms.

### **Problem Definition / User Needs**

**Core problem:**  
Parents want to share photos of their children without permanently giving up control over how those images are accessed, retained, or redistributed.

**Key user needs:**

* Ability to share photos through existing messaging apps without requiring recipients to install a new app.

* Control over how long a photo is accessible.

* Control over how many people can view a photo.

* Ability to revoke access if circumstances change.

* Clear communication of expectations around resharing and usage.

* Low-friction sharing that does not disrupt family dynamics or create social awkwardness.

**Unmet needs in existing solutions:**

* Messaging apps prioritize delivery, not post-delivery control.

* Private photo apps prioritize storage and albums, not granular sharing control.

* Other solutions require recipients to install a new app.

## **Objectives**

### **Vision**

To enable parents to share photos confidently by shifting photo sharing from a **permanent handoff** to a **controlled, time-bound permission**—without changing where or how families communicate.

### **Goals**

1. **Restore control to the sender** by allowing parents to define access rules before sharing.

2. **Prevent over-sharing** by limiting reuse, forwarding, and indefinite access.

3. **Fit naturally into existing messaging workflows** rather than replacing them.

4. **Reduce parental anxiety and regret** associated with sharing sensitive images.

5. **Establish a new mental model** for photo sharing: access is granted temporarily and selectively, not transferred permanently.

Early success indicators (conceptual, not metrics):

* Parents consistently choose controlled links over direct photo attachments.

* Recipients can access photos without confusion or additional setup.

* Sharing feels safer without feeling restrictive or technical.

### **Product Positioning**

This product is positioned as a **controlled photo sharing layer**, not a photo storage service or a messaging platform.

* **Not a private photo album:** The primary unit is a shareable link, not a library.

* **Not a replacement for messaging apps:** The app works within existing messaging ecosystems.

* **Not absolute security:** The product focuses on practical, everyday control rather than perfect enforcement.

Positioning statement:

“Share photos without losing control.”

“Share photos as links with controllable access—designed for sharing in messaging apps.”

“Share family photos safely, without giving them away.”

Key differentiation:

* Emphasis on **post-share control** (expiration, device limits, revocation).  
  * Senders define and manage the photo’s lifecycle *after* sharing.  
* Designed specifically for **sensitive, personal sharing**, starting with parents.

* Balances technical safeguards with social clarity and ease of use.

## **Target Users & Use Cases**

### **Target Users**

#### **Primary Users: Privacy-Conscious Parents**

**Who they are**

* Parents or legal guardians of infants, toddlers, and school-age children.

* Regularly share photos with family members, caregivers, or small social groups.

* Use mainstream messaging apps (WhatsApp, iMessage, Telegram, Signal) as their primary sharing channels.

**Key characteristics**

* High emotional sensitivity around children’s images.

* Increasing awareness of digital permanence and unintended redistribution.

* Low tolerance for complex setup or requiring others to adopt new apps.

* Motivated more by *peace of mind* than by technical security guarantees.

**Why they are the initial focus**

* High-frequency sharing behavior.

* Clear, emotionally charged problem.

* Willingness to adopt new tools if friction is low.

* Strong word-of-mouth potential within family and parent communities.

#### **Secondary Users: Recipients (Family, Caregivers, Close Contacts)**

**Who they are**

* Grandparents, extended family, babysitters, teachers, close friends.

* Often less privacy-focused or less technically sophisticated than the sender.

* Typically do not want additional apps or accounts.

**Role in the product**

* Passive participants.

* Expected to view content with minimal friction.

* Should clearly understand access limits and sharing expectations.

**Design implication**

* The product must work without requiring recipient onboarding, registration, or education.

### **Use Cases**

#### **1\. Sharing Safely in Family Messaging Groups (Primary Use Case)**

A parent shares photos of their child in a WhatsApp family group with a link so the photo is not being transferred to external storage systems. Additional controls allow the parent to decide how many people can see the picture so forwarding can be reduced as much as possible. Parent creates a controlled link with and device limit aligned to group size  and monitors status for reassurance. 

**2\. Sharing with Caregivers or Schools**  
A parent shares photos with a babysitter, daycare provider, or teacher with temporary access and only with 1 device. Parent sets short expiration and limited devices. Shares link directly via message and revokes access if no longer appropriate.

#### **3\. One-Off Sensitive Shares** A parent wants to share a sensitive or personal image (e.g., medical, emotional, or vulnerable moment). Needs high confidence that the photo won’t persist and ability to stop access immediately if regret occurs. Parent creates a single-device and monitors status for reassurance.

#### **4\. Sharing Across Generations or Relatives with Different Norms** A parent shares photos with relatives who may have different assumptions about resharing. Needs Clear, non-confrontational communication of expectations. Expectations are conveyed through product behavior rather than personal messaging.

#### **5\. Controlled Sharing Outside Immediate Family (Edge Use Case)** A parent shares photos with friends or acquaintances (e.g., playgroup parents). Needs to limit scope and duration and prevent photos from spreading beyond intended context. Parent sets a small device limit and short expiry and shares link in group chat or direct message. 

## **Core Features**

### **MVP Features**

#### **1\. Controlled Share Links**

* Photos are shared via generated links rather than raw file attachments.

* Links can be opened in a browser or lightweight viewer without requiring recipient authentication.

#### **2\. Time-Limited Access (Expiration)**

* Sender can define how long a photo or set of photos is accessible.

* Expiration options include:

  * After 1 hours, after 1 day, after 1 week, after 1 month, after 1 year, custom

* Access automatically ends when expiration is reached.

#### **3\. Access Revocation**

* Sender can manually disable a link at any time.

* Revocation immediately blocks further access, regardless of expiration or device count.

#### **5\. Prevent Downloads**

* Sender can choose whether recipients may download the photo.

* Downloads allowed/disallowed

#### **6\. Recipient-Friendly Viewing Experience**

* Links open in a clean, focused viewer optimized for mobile devices.  
* Sender has the option to include a preview of the picture for ease of recognition on the messaging app. Consequences are clearly communicated, the preview thumbnail is sent to the messaging company.  
* No account creation or app installation required for recipients.  
* Clear messaging when access is limited or blocked.

**7\. Metadata Stripping**  
Remove location, Device info, Timestamp

**8\. End-toEnd encryption**

### **Post-MVP Features**

#### **9\. Device-Based Access Limits**

* Sender can limit how many distinct devices may access a shared link.

* Each unique device consumes one access slot.

* Once the limit is reached, additional devices are blocked.

#### **10\. Reporting and Transparency**

* Sender can see number of devices that have accessed the link. Device type \+ time

* ### Screenshot recording warnings

#### **11\. Shared Rules (Opt-In)** Shared Rules are a social contract, not a technical lock. They make family photo-sharing norms explicit**,** visible and reinforced by the product. 

### Shared Rules exist to resolve a common, unspoken tension for parents:

### *“I don’t want to be rude — but please don’t reshare photos of my kid.”*

### Examples:

* ### A grandparent sees resharing as affection.

* ### A parent sees resharing as a violation.

* ### Neither party has explicitly discussed expectations.

**11.1 Rule Templates**  
The product provides empathetic, pre-written rule templates, such as:

* “Please don’t forward photos without asking”  
* “No posting on social media”

* “Photos are for family viewing only”  
* “Please delete after viewing”  
* “No screenshots if possible”

**11.2 Rule Scope**

#### **Family-Level Rules** are set once, apply across all shared photos, represent long-term family norms. Example: *“In our family, we don’t post children’s photos online.”*

#### **Link-Level Rules** are applied to a specific photo or share and used for heightened sensitivity or nuance. Example: “This photo is especially private — please don’t forward it.”

Rules are visible but lightweight. They may appear, on recipient onboarding (they need to agree), as a collapsible section or as a footer reminder.

Shared Rules are supported by **gentle behavioral reinforcement**, not enforcement. On first view: “Thanks for respecting these sharing rules ❤️”

#### **12\. Sharing groups (Maybe)**

User defines sharing groups with custom defaults. We can investigate deep linking to whatsapp groups. 

**13\. Context tracking**  
 Track who users have shared with using the app.

* User creates link → Shares to WhatsApp Family Group  
* You store: { context: "Family Group", timestamp: now }  
* Next time: Show "Recently shared with: Family Group"  
* Tap it → Opens WhatsApp (via deep link)

**User Flow \- Sharene App (Temporary name)**

### **Primary flow \- Share Picture or Video**

1. Select photo  
   1. Launch Sharene  
      1. Choose photo from gallery  
      2. A link is created  
      3. The link is created and copied to clipboard with smart defaults: a preview of the image with a disclaimer that the image thumbnail will be shared with the messaging app, a default text: ‘user’ shared a photo, expiry: never, device limit: none.   
      4. If the user changes the defaults the link is updated.  
      5. The user can also add special family rules specific to that link, ie: don’t forward.  
      6. Actions available: copy link, share which opens the native system share sheet.  
   2. From System Photos App  
      1. Select photo  
      2. Click share  
      3. System share screen \- Choose to share with Sharene  
      4. A link is created.  
         1. The link is created and copied to clipboard with smart defaults: a preview of the image with a disclaimer that the image thumbnail will be shared with the messaging app,  a default text: ‘user’ shared a photo, expiry: never, device limit: none.   
         2. If the user changes the defaults the link is updated.  
         3. The user can also add special family rules specific to that link, ie: don’t forward.  
         4. Actions available: copy link, share which opens the native system share sheet.  
         5. The app should track sharing patterns within the app (post MVP) Who users have shared with.  
            1. User creates link → Shares to WhatsApp Family Group  
            2. Store: { context: "Family Group", timestamp: now }  
            3. Next time: Show "Recently shared with: Family Group"  
            4. Tap it → Opens WhatsApp (via deep link)  
      5. The link is now active and tracked  
         1. Appears in Active Links dashboard  
         2. Access tracking enabled  
         3. Expiry countdown started  
         4. Device limit enforced

### **Manage Links**

1. Open Sharene app  
   1. Links Dashboard where the user can see all links active, revoked or expired.  
   2. For each link the user can see:  
      1. View count  
      2. Device list  
      3. Time remaining  
      4. Access history  
   3. Actions: Extend, modify, copy link, share, revoke, delete (for non active links only)

### **Onboarding Flow \- First time use**

1. First App Launch  
2. Welcome Screen  
   1. Shows value proposition  
      1. Share photos without losing control  
      2. Key benefits explained  
      3. Visual examples of the experience of sharing photos with Sharene  
3. Authentication  
   1. Google Sign-In  
   2. Apple Sign-In  
   3. Email/Password  
   4. Terms acceptance  
4. Set family rules  
   1. Choose from templates or Create custom  
   2. Skip  
5. Main App Screen  
   1. Empty state shown  
   2. Share your first photo prompt

### **Edit Settings**

1. Admin screen to change default link settings, family rules and general settings such as image and password

### **Recipient flow**

1. Receives links in messaging app  
   1. Link includes a thumbnail of the picture (if set up by sender), a text description and a url link.  
2. Link validation  
   1. Link exists?  
   2. Not expired?  
   3. Not revoked?  
   4. Device limit not reached?  
   5. Generate device fingerprint  
3. If link valid and first time user, show family rules with an I understand button.  
4. Clicking on the link shows a photo viewer. Any family rules set by the sender are displayed as well.  
5. If link invalid show error screen  
6. Log access  
   1. Track device  
   2. Time  
7. If user takes screenshot show detection attempt, warn and log the event which then will be displayed in dashboard.  
   

